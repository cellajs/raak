import { eq, inArray } from 'drizzle-orm';
import { deleteTasks, updateTask } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateServerHLC } from '#/core/stx';
import { baseDb as db } from '#/db/db';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { mockFetchRequest, setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

const projectId = generateId();
const taskId = generateId();
const attachmentIds = {
  referenced: generateId(),
  keyReferenced: generateId(),
  unreferenced: generateId(),
};
// UUID-shaped id with no attachment row behind it (doctored block prop)
const unknownId = generateId();

const mediaBlock = (type: string, url: string, attachmentId: string) => ({
  id: generateId(),
  type,
  props: { backgroundColor: 'default', name: 'file', url, attachmentId, caption: '' },
  children: [],
});

const updateStx = () => ({
  ...mockStxBase(`stx:${generateId()}`),
  fieldTimestamps: { description: generateServerHLC('test-client') },
});

// Covers the derived host array: task.attachments mirrors description media blocks
// (attachmentId props), filtered to live in-org rows. The delete cascade is CDC-owned,
// so task deletion must NOT synchronously touch attachment rows.
describe('Task attachments derivation (owned embedding host array)', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;

  beforeAll(async () => {
    mockFetchRequest();
    tenant = await createTestTenant(call, 'task-attachments-derivation');

    await db.insert(projectsTable).values({
      id: projectId,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      name: 'Derivation project',
      slug: `derivation-${projectId.slice(0, 8)}`,
      createdBy: tenant.user.id,
    });

    await db.insert(tasksTable).values({
      id: taskId,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      projectId,
      name: 'derivation task',
      summary: '',
      variant: 1,
      displayOrder: 1,
      status: TaskStatus.Unstarted,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    });

    const baseAttachment = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      projectId,
      bucketName: 'test-bucket',
      contentType: 'image/png',
      size: '1024',
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    };
    await db.insert(attachmentsTable).values([
      {
        ...baseAttachment,
        id: attachmentIds.referenced,
        name: 'referenced',
        filename: 'ref.png',
        originalKey: `${projectId}/ref.png`,
      },
      {
        ...baseAttachment,
        id: attachmentIds.keyReferenced,
        name: 'key referenced',
        filename: 'key.png',
        originalKey: `${projectId}/key.png`,
      },
      {
        ...baseAttachment,
        id: attachmentIds.unreferenced,
        name: 'unreferenced',
        filename: 'un.png',
        originalKey: `${projectId}/un.png`,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(attachmentsTable).where(inArray(attachmentsTable.id, Object.values(attachmentIds)));
    await db.delete(tasksTable).where(eq(tasksTable.id, taskId));
    await db.delete(projectsTable).where(eq(projectsTable.id, projectId));
    await clearSecurityTestData();
  });

  const putDescription = async (description: string) =>
    call(updateTask, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId, id: taskId },
      body: { ops: { description }, stx: updateStx() },
      headers: { ...defaultHeaders, Cookie: tenant.sessionCookie },
    });

  it('derives task.attachments from media-block attachmentId props, dropping unknown ids', async () => {
    const description = JSON.stringify([
      // Private-mode block: url and attachmentId both hold the attachment id
      mediaBlock('image', attachmentIds.referenced, attachmentIds.referenced),
      // Public-mode block: url holds the storage key, attachmentId the entity id
      mediaBlock('file', `${projectId}/key.png`, attachmentIds.keyReferenced),
      // Doctored block: UUID-shaped attachmentId without a row must be filtered out
      mediaBlock('image', unknownId, unknownId),
    ]);

    const result = await putDescription(description);
    expect(result.response.status).toBe(200);

    const [task] = await db
      .select({ attachments: tasksTable.attachments })
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId));
    expect([...task.attachments].sort()).toEqual([attachmentIds.referenced, attachmentIds.keyReferenced].sort());
  });

  it('clearing the description empties the derived array', async () => {
    const result = await putDescription('');
    expect(result.response.status).toBe(200);

    const [task] = await db
      .select({ attachments: tasksTable.attachments })
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId));
    expect(task.attachments).toEqual([]);
  });

  it('deleting a task leaves attachment rows untouched in-request (CDC owns the cascade)', async () => {
    const result = await call(deleteTasks, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId },
      body: { ids: [taskId], stx: mockStxBase() },
      headers: { ...defaultHeaders, Cookie: tenant.sessionCookie },
    });
    expect(result.response.status).toBe(200);

    const rows = await db
      .select({ id: attachmentsTable.id, deletedAt: attachmentsTable.deletedAt })
      .from(attachmentsTable)
      .where(eq(attachmentsTable.projectId, projectId));
    for (const row of rows) expect(row.deletedAt).toBeNull();

    const [task] = await db
      .select({ deletedAt: tasksTable.deletedAt })
      .from(tasksTable)
      .where(eq(tasksTable.id, taskId));
    expect(task.deletedAt).not.toBeNull();
  });
});
