import { and, eq } from 'drizzle-orm';
import { updateTask } from 'sdk';
import { appConfig } from 'shared';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateServerHLC } from '#/core/stx';
import { getSeedDb } from '#/db/db';
import type { ActivityEvent } from '#/lib/activity-bus';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { notificationsTable } from '#/modules/notification/notification-db';
import { fanOutNotifications } from '#/modules/notification/operations/fan-out';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createOrgUser, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

// Direct table seeding and inspection run as admin: tasks are RLS-subject and the runtime role sees them only inside a tenant transaction.
const db = getSeedDb();

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

const updateStx = () => ({ ...mockStxBase(`stx:${generateId()}`), fieldTimestamps: { description: generateServerHLC('test-client') } });

const nullAncestorScopes = Object.fromEntries(
  appConfig.channelEntityTypes
    .filter((channelType) => channelType !== 'organization')
    .map((channelType) => [appConfig.entityIdColumnKeys[channelType], null]),
);

// Covers the task notification source: the fan-out reads mentions from the stored description and
// keeps only users who may read the task.
describe('Task mention notifications', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;
  let member: { id: string };

  beforeAll(async () => {
    tenant = await createTestTenant(call, 'task-mention-notifications');
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
    await db.delete(notificationsTable).where(eq(notificationsTable.subjectId, taskId));
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

  const updatedEvent = (): ActivityEvent =>
    // Test mock: the CDC worker fills the remaining columns; the fan-out reads only these.
    ({
      id: `act:${generateId()}`,
      type: 'task.updated',
      action: 'update',
      entityType: 'task',
      resourceType: null,
      tableName: 'tasks',
      subjectId: taskId,
      userId: tenant.user.id,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      ...nullAncestorScopes,
      projectId,
      rowData: null,
      rows: [{ rowData: { id: taskId, organizationId: tenant.organization.id, projectId }, seq: 1, movedFrom: null }],
      trace: null,
      stx: null,
      changedFields: ['description'],
    }) as unknown as ActivityEvent;

  const inboxOf = (userId: string) =>
    db
      .select({ type: notificationsTable.type })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.subjectId, taskId)));

  it('mentions readable users and drops ids without read access', async () => {
    const result = await putDescription(JSON.stringify([paragraphWithMentions([member.id, strangerId])]));
    expect(result.response.status).toBe(200);
    expect(await fanOutNotifications(updatedEvent())).toBe(true);
    expect(await inboxOf(member.id)).toEqual([{ type: 'mention' }]);
    expect(await inboxOf(strangerId)).toEqual([]);
  });

  it('adds no mention once the description no longer carries one', async () => {
    const result = await putDescription(JSON.stringify([paragraphWithMentions([])]));
    expect(result.response.status).toBe(200);
    expect(await fanOutNotifications(updatedEvent())).toBe(false);
    expect(await inboxOf(member.id)).toEqual([{ type: 'mention' }]);
  });
});
