import { inArray } from 'drizzle-orm';
import { getLabels, getTasks } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDb as db } from '#/db/db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createOrgUser, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

const projectA = generateId();
const projectB = generateId();
const taskA = generateId();
const taskB = generateId();

// A list without ?projectId is what the sync engine sends when tasks in several projects change in one flush.
describe('Task list read scope without a project', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;
  let member: Awaited<ReturnType<typeof createOrgUser>>;

  const listTasks = async (cookie: string, query: Record<string, string | number> = {}) => {
    const result = await call(getTasks, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId },
      query,
      headers: { ...defaultHeaders, Cookie: cookie },
    });
    const data = result.data as { items: { id: string }[]; total: number } | undefined;
    return { status: result.response.status, ids: (data?.items ?? []).map(({ id }) => id).sort(), total: data?.total };
  };

  beforeAll(async () => {
    tenant = await createTestTenant(call, 'task-list-scope');
    member = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'task-list-scope-member', 'member');

    const baseProject = { tenantId: tenant.tenantId, organizationId: tenant.organization.id, createdBy: tenant.user.id };
    await db.insert(projectsTable).values([
      { ...baseProject, id: projectA, name: 'Scope A', slug: `scope-a-${projectA.slice(0, 8)}` },
      { ...baseProject, id: projectB, name: 'Scope B', slug: `scope-b-${projectB.slice(0, 8)}` },
    ]);

    await db.insert(membershipsTable).values({
      id: generateId(),
      tenantId: tenant.tenantId,
      channelType: 'project',
      channelId: projectA,
      userId: member.id,
      role: 'member',
      displayOrder: 1,
      createdBy: tenant.user.id,
      organizationId: tenant.organization.id,
      projectId: projectA,
    });

    const baseTask = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      summary: '',
      primaryLabelId: crypto.randomUUID(),
      displayOrder: 1,
      status: TaskStatus.Unstarted,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    };
    await db.insert(tasksTable).values([
      // A range read starts after a position, so rows need a seq above 0 as CDC would stamp them
      { ...baseTask, id: taskA, projectId: projectA, name: 'in A', seq: 1 },
      { ...baseTask, id: taskB, projectId: projectB, name: 'in B', seq: 2 },
    ]);
  });

  afterAll(async () => {
    await db.delete(tasksTable).where(inArray(tasksTable.id, [taskA, taskB]));
    await db.delete(projectsTable).where(inArray(projectsTable.id, [projectA, projectB]));
    await clearSecurityTestData();
  });

  it('an organization admin reads the tasks of every project', async () => {
    const normal = await listTasks(tenant.sessionCookie);
    expect(normal.status).toBe(200);
    expect(normal.ids).toEqual([taskA, taskB].sort());
    expect(normal.total).toBe(2);

    const delta = await listTasks(tenant.sessionCookie, { afterSeq: 0, untilSeq: 999999999 });
    expect(delta.ids).toEqual([taskA, taskB].sort());
  });

  it('a project member reads only the tasks of their projects', async () => {
    const result = await listTasks(member.sessionCookie);
    expect(result.status).toBe(200);
    expect(result.ids).toEqual([taskA]);
  });

  it('an unknown project still answers 404 for tasks and labels', async () => {
    const unknown = generateId();
    expect((await listTasks(tenant.sessionCookie, { projectId: unknown })).status).toBe(404);

    const labels = await call(getLabels, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId },
      query: { projectId: unknown },
      headers: { ...defaultHeaders, Cookie: tenant.sessionCookie },
    });
    expect(labels.response.status).toBe(404);
  });
});
