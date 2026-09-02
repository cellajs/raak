import { eq } from 'drizzle-orm';
import { updateTask } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateServerHLC } from '#/core/stx';
import { baseDb as db } from '#/db/db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createOrgUser, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { mockFetchRequest, setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

const projectId = generateId();
const taskId = generateId();
// UUID-shaped id with no user behind it (doctored mention node)
const strangerId = generateId();

const paragraphWithMentions = (ids: string[]) => ({
  id: generateId(),
  type: 'paragraph',
  props: {},
  content: ids.map((id) => ({ type: 'mention', props: { id, name: 'someone', slug: 'someone' } })),
  children: [],
});

const updateStx = () => ({
  ...mockStxBase(`stx:${generateId()}`),
  fieldTimestamps: { description: generateServerHLC('test-client') },
});

// Covers the task notification source: `task.mentions` is derived server-side from the stored
// description on every write and keeps only users who may read the task.
describe('Task mentions derivation (notification source)', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;
  let member: { id: string };

  beforeAll(async () => {
    mockFetchRequest();
    tenant = await createTestTenant(call, 'task-mentions-derivation');
    member = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'task-mentions-member');

    await db.insert(projectsTable).values({
      id: projectId,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      name: 'Mentions project',
      slug: `mentions-${projectId.slice(0, 8)}`,
      createdBy: tenant.user.id,
    });

    // Raak grants task reads to project members only, so the mentioned user joins the project.
    await db.insert(membershipsTable).values({
      id: generateId(),
      tenantId: tenant.tenantId,
      channelType: 'project',
      channelId: projectId,
      userId: member.id,
      role: 'member',
      displayOrder: 1,
      createdBy: tenant.user.id,
      organizationId: tenant.organization.id,
      projectId,
    });

    await db.insert(tasksTable).values({
      id: taskId,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      projectId,
      name: 'mentions task',
      summary: '',
      primaryLabelId: crypto.randomUUID(),
      displayOrder: 1,
      status: TaskStatus.Unstarted,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    });
  });

  afterAll(async () => {
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

  const storedMentions = async () => {
    const [task] = await db.select({ mentions: tasksTable.mentions }).from(tasksTable).where(eq(tasksTable.id, taskId));
    return task.mentions;
  };

  it('stores readable mentioned users and drops ids without read access', async () => {
    const result = await putDescription(JSON.stringify([paragraphWithMentions([member.id, strangerId])]));
    expect(result.response.status).toBe(200);
    expect(await storedMentions()).toEqual([member.id]);
  });

  it('clears mentions once the description no longer carries them', async () => {
    const result = await putDescription(JSON.stringify([paragraphWithMentions([])]));
    expect(result.response.status).toBe(200);
    expect(await storedMentions()).toEqual([]);
  });
});
