import { eq, inArray } from 'drizzle-orm';
import { getUnseenCounts, getUnseenTaskIds, markSeen } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDb as db } from '#/db/db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { createSystemAdminUser, createTestSession } from './helpers';
import { clearSecurityTestData, createOrgUser, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const memberProject = generateId();
const otherProject = generateId();

describe('Unseen task ids', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;
  let member: Awaited<ReturnType<typeof createOrgUser>>;
  const insertedTaskIds: string[] = [];

  const insertTask = async (overrides: { projectId: string } & Partial<typeof tasksTable.$inferInsert>) => {
    const id = generateId();
    insertedTaskIds.push(id);
    await db.insert(tasksTable).values({
      id,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      name: id,
      summary: '',
      primaryLabelId: crypto.randomUUID(),
      displayOrder: 1,
      status: TaskStatus.Unstarted,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
      createdAt: daysAgo(1),
      ...overrides,
    });
    return id;
  };

  const unseenIds = async (cookie: string) => {
    const { data, response } = await call(getUnseenTaskIds, {
      path: { tenantId: tenant.tenantId, organizationId: tenant.organization.id },
      headers: { ...defaultHeaders, Cookie: cookie },
    });
    expect(response.status).toBe(200);
    return (data as { items: string[] } | undefined)?.items ?? [];
  };

  const addProjectMembership = async (userId: string, projectId: string, createdAt: string) => {
    await db.insert(membershipsTable).values({
      id: generateId(),
      tenantId: tenant.tenantId,
      channelType: 'project',
      channelId: projectId,
      userId,
      role: 'member',
      displayOrder: 1,
      createdBy: tenant.user.id,
      organizationId: tenant.organization.id,
      projectId,
      createdAt,
    });
  };

  beforeAll(async () => {
    tenant = await createTestTenant(call, 'task-unseen-ids');
    member = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'task-unseen-ids-member', 'member');

    const baseProject = { tenantId: tenant.tenantId, organizationId: tenant.organization.id, createdBy: tenant.user.id };
    await db.insert(projectsTable).values([
      { ...baseProject, id: memberProject, name: 'Unseen A', slug: `unseen-a-${memberProject.slice(0, 8)}` },
      { ...baseProject, id: otherProject, name: 'Unseen B', slug: `unseen-b-${otherProject.slice(0, 8)}` },
    ]);
    await addProjectMembership(member.id, memberProject, daysAgo(10));
  });

  afterAll(async () => {
    await db.delete(tasksTable).where(inArray(tasksTable.id, insertedTaskIds));
    await db.delete(projectsTable).where(inArray(projectsTable.id, [memberProject, otherProject]));
    await clearSecurityTestData();
  });

  it('returns only the tasks the badge counts, for a user who joined before them', async () => {
    const unseen = await insertTask({ projectId: memberProject });
    const seen = await insertTask({ projectId: memberProject });
    await insertTask({ projectId: memberProject, deletedAt: daysAgo(1) });
    await insertTask({ projectId: otherProject });

    await call(markSeen, {
      path: { tenantId: tenant.tenantId, organizationId: tenant.organization.id },
      body: { entityIds: [seen], entityType: 'task' },
      headers: { ...defaultHeaders, Cookie: member.sessionCookie },
    });

    const ids = await unseenIds(member.sessionCookie);
    expect(ids).toEqual([unseen]);

    const { data: counts } = await call(getUnseenCounts, { headers: { ...defaultHeaders, Cookie: member.sessionCookie } });
    expect((counts as Record<string, Record<string, number>> | undefined)?.[memberProject]?.task).toBe(ids.length);
  });

  it('skips tasks from before the user joined the project', async () => {
    const newcomer = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'task-unseen-ids-newcomer', 'member');
    const before = await insertTask({ projectId: memberProject, createdAt: daysAgo(5) });
    const since = await insertTask({ projectId: memberProject, createdAt: daysAgo(1) });
    await addProjectMembership(newcomer.id, memberProject, daysAgo(3));

    const ids = await unseenIds(newcomer.sessionCookie);
    expect(ids).toContain(since);
    expect(ids).not.toContain(before);
  });

  it('floors an organization admin without a project membership at the organization join date', async () => {
    const orgAdmin = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'task-unseen-ids-admin', 'admin');
    await db
      .update(membershipsTable)
      .set({ createdAt: daysAgo(3) })
      .where(eq(membershipsTable.userId, orgAdmin.id));
    const since = await insertTask({ projectId: otherProject, createdAt: daysAgo(1) });
    const before = await insertTask({ projectId: otherProject, createdAt: daysAgo(5) });

    const ids = await unseenIds(orgAdmin.sessionCookie);
    expect(ids).toContain(since);
    expect(ids).not.toContain(before);
  });

  it('gives a system admin without memberships no join floor', async () => {
    const before = await insertTask({ projectId: otherProject, createdAt: daysAgo(30) });
    const admin = await createSystemAdminUser(`task-unseen-ids-${generateId().slice(-8)}@test.com`);

    expect(await unseenIds(await createTestSession(admin))).toContain(before);
  });

  it('leaves out tasks older than the seen window, and returns the newest first', async () => {
    const outside = await insertTask({ projectId: otherProject, createdAt: daysAgo(400) });
    const older = await insertTask({ projectId: otherProject, createdAt: daysAgo(2) });
    const newer = await insertTask({ projectId: otherProject, createdAt: daysAgo(1) });
    const admin = await createSystemAdminUser(`task-unseen-ids-${generateId().slice(-8)}@test.com`);

    const ids = await unseenIds(await createTestSession(admin));
    expect(ids).not.toContain(outside);
    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));
  });

  it('caps the list at the newest 200', async () => {
    const admin = await createSystemAdminUser(`task-unseen-ids-${generateId().slice(-8)}@test.com`);
    const before = await unseenIds(await createTestSession(admin));
    const missing = 201 - before.length;
    for (let i = 0; i < missing; i++) await insertTask({ projectId: otherProject, createdAt: daysAgo(2) });

    expect(await unseenIds(await createTestSession(admin))).toHaveLength(200);
  });
});
