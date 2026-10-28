import { getProject } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getSeedDb } from '#/db/db';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

// Seeded as admin: tasks are RLS-subject, and the counts must come through the request's own tenant read.
const db = getSeedDb();

setTestConfig({ enabledAuthStrategies: ['passkey'] });

// Run it as `TEST_DB_ROLE=runtime` too: the superuser of the default run reads past RLS.
describe('Task status counts of a project', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;
  const projectId = generateId();

  beforeAll(async () => {
    tenant = await createTestTenant(call, 'task-status-counts');
    const scope = { tenantId: tenant.tenantId, organizationId: tenant.organization.id };
    await db
      .insert(projectsTable)
      .values({ ...scope, id: projectId, name: 'Counted', slug: `counted-${projectId.slice(0, 8)}`, createdBy: tenant.user.id });

    const task = (status: TaskStatus) => ({
      ...scope,
      id: generateId(),
      projectId,
      summary: '',
      primaryLabelId: crypto.randomUUID(),
      displayOrder: 1,
      status,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    });
    await db.insert(tasksTable).values([task(TaskStatus.Unstarted), task(TaskStatus.Unstarted), task(TaskStatus.Started)]);
  });

  afterAll(async () => await clearSecurityTestData());

  it("counts the project's tasks by status", async () => {
    const result = await call(getProject, {
      path: { tenantId: tenant.tenantId, organizationId: tenant.organization.id, id: projectId },
      query: { include: 'counts' },
      headers: { ...defaultHeaders, Cookie: tenant.sessionCookie },
    });

    expect(result.response.status).toBe(200);
    expect((result.data as { included: { counts: { taskStatusCounts: unknown } } }).included.counts.taskStatusCounts).toEqual({
      iced: 0,
      unstarted: 2,
      started: 1,
      finished: 0,
      delivered: 0,
      reviewed: 0,
      accepted: 0,
    });
  });
});
