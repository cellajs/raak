import { getLabelOlderAcceptedCounts } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getSeedDb } from '#/db/db';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createOrgUser, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

// Seeded as admin: tasks are RLS-subject, and the counts must come through the request's own tenant read.
const db = getSeedDb();

setTestConfig({ enabledAuthStrategies: ['passkey'] });

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

// Run it as `TEST_DB_ROLE=runtime` too: the superuser of the default run reads past RLS.
describe('Older accepted task counts per label', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;
  let member: Awaited<ReturnType<typeof createOrgUser>>;
  const projectId = generateId();

  const counts = (cookie: string, id = projectId) =>
    call(getLabelOlderAcceptedCounts, {
      path: { tenantId: tenant.tenantId, organizationId: tenant.organization.id },
      query: { projectId: id, acceptedCutOff: 14 },
      headers: { ...defaultHeaders, Cookie: cookie },
    });

  beforeAll(async () => {
    tenant = await createTestTenant(call, 'label-older-accepted');
    member = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'label-older-accepted-member', 'member');

    const scope = { tenantId: tenant.tenantId, organizationId: tenant.organization.id };
    await db
      .insert(projectsTable)
      .values({ ...scope, id: projectId, name: 'Counted', slug: `counted-${projectId.slice(0, 8)}`, createdBy: tenant.user.id });

    const task = (status: TaskStatus, statusChangedAt: string, labels: string[], deletedAt?: string) => ({
      ...scope,
      id: generateId(),
      projectId,
      summary: '',
      primaryLabelId: crypto.randomUUID(),
      displayOrder: 1,
      status,
      statusChangedAt,
      labels,
      deletedAt,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    });
    await db
      .insert(tasksTable)
      .values([
        task(TaskStatus.Accepted, daysAgo(30), ['bug', 'docs']),
        task(TaskStatus.Accepted, daysAgo(20), ['bug']),
        task(TaskStatus.Accepted, daysAgo(2), ['bug']),
        task(TaskStatus.Started, daysAgo(30), ['bug']),
        task(TaskStatus.Accepted, daysAgo(30), ['bug'], daysAgo(1)),
      ]);
  });

  afterAll(async () => await clearSecurityTestData());

  it('counts only live tasks accepted before the cut-off, per label', async () => {
    const result = await counts(tenant.sessionCookie);

    expect(result.response.status).toBe(200);
    expect(result.data).toEqual({ bug: 2, docs: 1 });
  });

  it('counts nothing for a project the caller may not read', async () => {
    const result = await counts(member.sessionCookie);

    expect(result.response.status).toBe(200);
    expect(result.data).toEqual({});
  });
});
