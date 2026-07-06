/**
 * End-to-end proof of the host lifecycle cascade (hierarchy `host: 'task'`).
 *
 * Deleting a task soft-deletes the attachments it hosts (attachments.taskId) through the
 * generic cascade helper — the hand-rolled groupId cascade is gone. Unhosted attachments
 * and attachments of other tasks are untouched.
 *
 * Requires: PostgreSQL (core mode or higher)
 */

import { eq, inArray } from 'drizzle-orm';
import { deleteTasks } from 'sdk';
import { generateId } from 'shared/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
const deletedTaskId = generateId();
const survivingTaskId = generateId();
const attachmentIds = {
  hostedByDeleted1: generateId(),
  hostedByDeleted2: generateId(),
  hostedBySurviving: generateId(),
  unhosted: generateId(),
};

describe('Task host cascade (attachments follow their task)', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;

  beforeAll(async () => {
    mockFetchRequest();
    tenant = await createTestTenant(call, 'task-host-cascade');

    await db.insert(projectsTable).values({
      id: projectId,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      name: 'Host cascade project',
      slug: `host-cascade-${projectId.slice(0, 8)}`,
      createdBy: tenant.user.id,
    });

    const baseTask = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      projectId,
      summary: '',
      variant: 1,
      displayOrder: 1,
      status: TaskStatus.Unstarted,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    };
    await db.insert(tasksTable).values([
      { ...baseTask, id: deletedTaskId, name: 'task to delete' },
      { ...baseTask, id: survivingTaskId, name: 'surviving task' },
    ]);

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
        id: attachmentIds.hostedByDeleted1,
        name: 'hosted 1',
        filename: 'h1.png',
        originalKey: `${projectId}/h1.png`,
        taskId: deletedTaskId,
      },
      {
        ...baseAttachment,
        id: attachmentIds.hostedByDeleted2,
        name: 'hosted 2',
        filename: 'h2.png',
        originalKey: `${projectId}/h2.png`,
        taskId: deletedTaskId,
      },
      {
        ...baseAttachment,
        id: attachmentIds.hostedBySurviving,
        name: 'other task',
        filename: 'other.png',
        originalKey: `${projectId}/other.png`,
        taskId: survivingTaskId,
      },
      {
        ...baseAttachment,
        id: attachmentIds.unhosted,
        name: 'unhosted',
        filename: 'unhosted.png',
        originalKey: `${projectId}/unhosted.png`,
        taskId: null,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(attachmentsTable).where(inArray(attachmentsTable.id, Object.values(attachmentIds)));
    await db.delete(tasksTable).where(inArray(tasksTable.id, [deletedTaskId, survivingTaskId]));
    await db.delete(projectsTable).where(inArray(projectsTable.id, [projectId]));
    await clearSecurityTestData();
  });

  it('deleting a task soft-deletes its hosted attachments and nothing else', async () => {
    const result = await call(deleteTasks, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId },
      body: { ids: [deletedTaskId], stx: mockStxBase() },
      headers: { ...defaultHeaders, Cookie: tenant.sessionCookie },
    });
    expect(result.response.status).toBe(200);

    const rows = await db
      .select({ id: attachmentsTable.id, deletedAt: attachmentsTable.deletedAt })
      .from(attachmentsTable)
      .where(eq(attachmentsTable.projectId, projectId));
    const byId = new Map(rows.map((row) => [row.id, row.deletedAt]));

    // Hosted by the deleted task → tombstoned
    expect(byId.get(attachmentIds.hostedByDeleted1)).not.toBeNull();
    expect(byId.get(attachmentIds.hostedByDeleted2)).not.toBeNull();
    // Hosted by another task / unhosted → untouched
    expect(byId.get(attachmentIds.hostedBySurviving)).toBeNull();
    expect(byId.get(attachmentIds.unhosted)).toBeNull();

    // The task itself is tombstoned
    const [task] = await db
      .select({ deletedAt: tasksTable.deletedAt })
      .from(tasksTable)
      .where(eq(tasksTable.id, deletedTaskId));
    expect(task.deletedAt).not.toBeNull();
  });
});
