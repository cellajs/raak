import { eq } from 'drizzle-orm';
import { createLabels, createTasks, updateLabel, updateTask } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { labelsTable } from '#/modules/label/label-db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase, mockStxFor } from '#/schemas/sync-transaction-mocks';
import { adminRole, defaultHeaders, memberRole } from '../fixtures';
import { adminDb, createTestOrganization } from '../helpers';
import { createAppClient, type TestResult } from '../test-client';
import { setTestConfig } from '../test-utils';
import { clearSecurityTestData, createOrgUser } from './helpers';
import { createApiProject } from './helpers-app';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

type User = { id: string; sessionCookie: string };

interface Row {
  route: string;
  /** The write, naming columns the caller may not set beside one they may. */
  send: () => Promise<TestResult>;
  /** The row after the write. */
  row: () => Promise<Record<string, unknown>>;
  /** The permitted field, as sent: proof that the write ran. */
  changed: Record<string, unknown>;
  /** The columns the caller may not set, with the values they must keep. */
  kept: () => Record<string, unknown>;
}

/**
 * Task and label create items and update ops are picked schemas: zod drops every other key. One that got through
 * would move a row to another tenant, forge its author, open a task to public reads or mark a label as tracked. A
 * dropped key stamped in the stx is refused outright, so the stamps name the permitted field only: the form that sticks.
 */
describe('Task and label columns outside the body pick', async () => {
  const call = await createAppClient();
  let path: { tenantId: string; organizationId: string };
  let admin: User;
  let member: User;
  let projectId: string;
  let taskId: string;
  let labelId: string;
  /** Another tenant's organization and user: ids its foreign keys would take. */
  let foreign: { tenantId: string; organizationId: string; userId: string };

  const headers = (as: User) => ({ ...defaultHeaders, Cookie: as.sessionCookie });
  const forged = () => ({ tenantId: foreign.tenantId, organizationId: foreign.organizationId, createdBy: foreign.userId, entityType: 'attachment' });
  const owned = (createdBy: string) => ({ ...path, createdBy });
  const taskRow = async (id: string) => (await adminDb.select().from(tasksTable).where(eq(tasksTable.id, id)))[0];
  const labelRow = async (id: string) => (await adminDb.select().from(labelsTable).where(eq(labelsTable.id, id)))[0];

  beforeAll(async () => {
    const organization = await createTestOrganization();
    path = { tenantId: organization.tenantId, organizationId: organization.id };
    admin = await createOrgUser(call, path.tenantId, path.organizationId, 'task-mass-admin', adminRole);
    member = await createOrgUser(call, path.tenantId, path.organizationId, 'task-mass-member', memberRole);
    ({ projectId } = await createApiProject(call, path, admin));
    await adminDb.insert(membershipsTable).values({
      id: generateId(),
      ...path,
      channelType: 'project',
      channelId: projectId,
      projectId,
      userId: member.id,
      role: 'member',
      displayOrder: 1,
      createdBy: admin.id,
    });
    invalidateCache.user(member.id);

    const other = await createTestOrganization();
    const otherUser = await createOrgUser(call, other.tenantId, other.id, 'task-mass-foreign', adminRole);
    foreign = { tenantId: other.tenantId, organizationId: other.id, userId: otherUser.id };

    taskId = generateId();
    labelId = generateId();
    const task = await call(createTasks, {
      path,
      body: [{ id: taskId, name: 'Task', description: null, projectId, status: TaskStatus.Unstarted, stx: mockStxBase() }],
      headers: headers(admin),
    });
    const label = await call(createLabels, {
      path,
      body: [{ id: labelId, name: 'tag', color: null, projectId, stx: mockStxBase() }],
      headers: headers(admin),
    });
    expect([task.response.status, label.response.status]).toEqual([201, 201]);
  });

  afterAll(async () => await clearSecurityTestData());

  const createdTask = generateId();
  const createdLabel = generateId();

  const rows: Row[] = [
    {
      route: 'createTasks',
      // The project is private: a task's public read is the project's decision, copied at create.
      send: () =>
        call(createTasks, {
          path,
          body: [
            {
              id: createdTask,
              name: 'Forged',
              description: null,
              projectId,
              status: TaskStatus.Unstarted,
              stx: mockStxBase(),
              ...forged(),
              public: true,
            },
          ] as never,
          headers: headers(member),
        }),
      row: () => taskRow(createdTask),
      changed: { name: 'Forged' },
      kept: () => ({ ...owned(member.id), entityType: 'task', public: false }),
    },
    {
      route: 'updateTask',
      send: () =>
        call(updateTask, {
          path: { ...path, id: taskId },
          body: { ops: { name: 'Renamed', ...forged() }, stx: mockStxFor('name') } as never,
          headers: headers(member),
        }),
      row: () => taskRow(taskId),
      changed: { name: 'Renamed' },
      kept: () => ({ ...owned(admin.id), entityType: 'task' }),
    },
    {
      route: 'createLabels',
      // A primary label, where tracking means anything, by the project admin who may create one.
      send: () =>
        call(createLabels, {
          path,
          body: [
            { id: createdLabel, name: 'Forged', color: null, mode: 'primary', projectId, stx: mockStxBase(), ...forged(), organizationTracked: true },
          ] as never,
          headers: headers(admin),
        }),
      row: () => labelRow(createdLabel),
      changed: { name: 'Forged', mode: 'primary' },
      kept: () => ({ ...owned(admin.id), entityType: 'label', organizationTracked: false }),
    },
    {
      route: 'updateLabel',
      send: () =>
        call(updateLabel, {
          path: { ...path, id: labelId },
          body: { ops: { name: 'renamed', ...forged() }, stx: mockStxFor('name') } as never,
          headers: headers(member),
        }),
      row: () => labelRow(labelId),
      changed: { name: 'renamed' },
      kept: () => ({ ...owned(admin.id), entityType: 'label' }),
    },
  ];

  it.each(rows)('must not set a column outside the pick via $route', async ({ send, row, changed, kept }) => {
    const { response } = await send();
    expect(response.status).toBeLessThan(300);
    expect(await row()).toMatchObject({ ...changed, ...kept() });
  });
});
