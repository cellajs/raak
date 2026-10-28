import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createLabels, createProjects, createTasks, createWorkspaces, getLabels, updateTask } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { labelsTable } from '#/modules/label/label-db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase, mockStxFor } from '#/schemas/sync-transaction-mocks';
import { adminRole, defaultHeaders } from './fixtures';
import { adminDb, createTestOrganization } from './helpers';
import { clearSecurityTestData, createOrgUser } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

type TaskResponse = { id: string; labels: { id: string }[]; assignedTo: { id: string }[]; primaryLabel: { id: string } | null };

describe('Task writes: moves, relation ids and full responses', async () => {
  const call = await createAppClient();
  let path: { tenantId: string; organizationId: string };
  let admin: Awaited<ReturnType<typeof createOrgUser>>;
  let member: Awaited<ReturnType<typeof createOrgUser>>;
  let outsider: Awaited<ReturnType<typeof createOrgUser>>;
  let leaver: Awaited<ReturnType<typeof createOrgUser>>;
  let orgAdmin: Awaited<ReturnType<typeof createOrgUser>>;
  let projectA: string;
  let projectB: string;
  let foreignProject: string;

  const headersOf = (user: { sessionCookie: string }) => ({ ...defaultHeaders, Cookie: user.sessionCookie });
  const firstId = (result: { data?: unknown }) => String((result.data as { data: { id: string }[] } | undefined)?.data[0].id);

  /** A project created through the API, so it has its primary labels and the creating admin is a member of it. */
  const createProject = async (orgPath: typeof path, user: { sessionCookie: string }, name: string) => {
    const headers = headersOf(user);
    const workspaceId = firstId(await call(createWorkspaces, { path: orgPath, body: [{ id: `temp-${nanoid()}`, name: 'Home' }], headers }));
    return firstId(
      await call(createProjects, {
        path: orgPath,
        query: { workspaceId },
        body: [{ id: `temp-${nanoid()}`, name, slug: `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`, public: false }],
        headers,
      }),
    );
  };

  const joinProjectA = (userId: string) =>
    adminDb.insert(membershipsTable).values({
      id: generateId(),
      tenantId: path.tenantId,
      channelType: 'project',
      channelId: projectA,
      userId,
      role: 'member',
      displayOrder: 1,
      createdBy: admin.id,
      organizationId: path.organizationId,
      projectId: projectA,
    });

  beforeAll(async () => {
    const org = await createTestOrganization();
    path = { tenantId: org.tenantId, organizationId: org.id };
    admin = await createOrgUser(call, org.tenantId, org.id, `task-writes-admin-${nanoid(6)}`, adminRole);
    member = await createOrgUser(call, org.tenantId, org.id, `task-writes-member-${nanoid(6)}`, 'member');
    outsider = await createOrgUser(call, org.tenantId, org.id, `task-writes-outsider-${nanoid(6)}`, 'member');
    leaver = await createOrgUser(call, org.tenantId, org.id, `task-writes-leaver-${nanoid(6)}`, 'member');
    orgAdmin = await createOrgUser(call, org.tenantId, org.id, `task-writes-org-admin-${nanoid(6)}`, adminRole);

    projectA = await createProject(path, admin, 'Alpha');
    projectB = await createProject(path, admin, 'Beta');

    // The member and the leaver work in project A only; the second admin is a member of no project
    await joinProjectA(member.id);
    await joinProjectA(leaver.id);

    const otherOrg = await createTestOrganization();
    const otherAdmin = await createOrgUser(call, otherOrg.tenantId, otherOrg.id, `task-writes-other-admin-${nanoid(6)}`, adminRole);
    foreignProject = await createProject({ tenantId: otherOrg.tenantId, organizationId: otherOrg.id }, otherAdmin, 'Foreign');
  });

  afterAll(async () => await clearSecurityTestData());

  const createTask = async (body: Record<string, unknown> = {}, user: { sessionCookie: string } = admin) => {
    const result = await call(createTasks, {
      path,
      body: [
        { id: crypto.randomUUID(), name: 'Task', description: null, projectId: projectA, status: TaskStatus.Unstarted, stx: mockStxBase(), ...body },
      ],
      headers: headersOf(user),
    });
    expect(result.response.status).toBe(201);
    return (result.data as { data: TaskResponse[] }).data[0];
  };

  const update = (user: { sessionCookie: string }, id: string, ops: Record<string, unknown>, query: { fullResponse?: boolean } = {}) =>
    call(updateTask, {
      path: { ...path, id },
      query,
      body: { ops, stx: mockStxFor(...Object.keys(ops).filter((key) => !['assignedTo', 'labels'].includes(key))) },
      headers: headersOf(user),
    });

  const storedRow = async (id: string) => (await adminDb.select().from(tasksTable).where(eq(tasksTable.id, id)))[0];

  const primaryLabelsOf = async (projectId: string) => {
    const result = await call(getLabels, { path, query: { projectId, modes: 'primary' }, headers: headersOf(admin) });
    return (result.data as { items: { id: string }[] }).items;
  };

  const createLabel = async (projectId: string) => {
    const id = crypto.randomUUID();
    const result = await call(createLabels, {
      path,
      body: [{ id, name: `tag-${id.slice(0, 8)}`, color: null, projectId, stx: mockStxBase() }],
      headers: headersOf(admin),
    });
    expect(result.response.status).toBe(201);
    return id;
  };

  it('refuses a member moving a task into a project they hold no grant in', async () => {
    const task = await createTask();

    const moved = await update(member, task.id, { projectId: projectB });

    expect(moved.response.status).toBe(403);
    expect((await storedRow(task.id)).projectId).toBe(projectA);
  });

  it('keeps the assignees a move adds in the same request', async () => {
    const task = await createTask();

    const moved = await update(admin, task.id, { projectId: projectB, assignedTo: { add: [admin.id], remove: [] } });

    expect(moved.response.status).toBe(200);
    expect(await storedRow(task.id)).toMatchObject({ projectId: projectB, assignedTo: [admin.id] });
  });

  it('answers a primary label change with the new primary label in a full response', async () => {
    const [first, second] = await primaryLabelsOf(projectA);
    const task = await createTask({ primaryLabelId: first.id });

    const changed = await update(admin, task.id, { primaryLabelId: second.id }, { fullResponse: true });

    expect(changed.response.status).toBe(200);
    expect((changed.data as TaskResponse).primaryLabel?.id).toBe(second.id);
  });

  it("stores only members and live labels of the task's own project as assignees and labels", async () => {
    const ownLabel = await createLabel(projectA);
    const foreignLabel = await createLabel(projectB);

    const task = await createTask({ labels: [ownLabel, foreignLabel], assignedTo: [admin.id, outsider.id] });

    expect({ labels: task.labels.map(({ id }) => id), assignedTo: task.assignedTo.map(({ id }) => id) }).toEqual({
      labels: [ownLabel],
      assignedTo: [admin.id],
    });
    expect(await storedRow(task.id)).toMatchObject({ labels: [ownLabel], assignedTo: [admin.id] });

    const added = await update(admin, task.id, { labels: { add: [foreignLabel], remove: [] }, assignedTo: { add: [outsider.id], remove: [] } });
    expect(added.response.status).toBe(200);
    expect(await storedRow(task.id)).toMatchObject({ labels: [ownLabel], assignedTo: [admin.id] });
  });

  it('keeps the assignees and labels the row holds when an update adds others', async () => {
    const goneLabel = await createLabel(projectA);
    const liveLabel = await createLabel(projectA);
    const task = await createTask({ labels: [goneLabel], assignedTo: [leaver.id] });
    expect(await storedRow(task.id)).toMatchObject({ labels: [goneLabel], assignedTo: [leaver.id] });

    await adminDb.delete(membershipsTable).where(and(eq(membershipsTable.userId, leaver.id), eq(membershipsTable.projectId, projectA)));
    await adminDb.update(labelsTable).set({ deletedAt: new Date().toISOString(), deletedBy: admin.id }).where(eq(labelsTable.id, goneLabel));

    const added = await update(admin, task.id, { assignedTo: { add: [member.id], remove: [] }, labels: { add: [liveLabel], remove: [] } });

    expect(added.response.status).toBe(200);
    const row = await storedRow(task.id);
    expect({ assignedTo: [...row.assignedTo].sort(), labels: [...row.labels].sort() }).toEqual({
      assignedTo: [leaver.id, member.id].sort(),
      labels: [goneLabel, liveLabel].sort(),
    });
  });

  it('lets an organization admin who is no project member assign themselves', async () => {
    const created = await createTask({ assignedTo: [orgAdmin.id] }, orgAdmin);
    expect(await storedRow(created.id)).toMatchObject({ assignedTo: [orgAdmin.id] });

    const task = await createTask();
    const assigned = await update(orgAdmin, task.id, { assignedTo: { add: [orgAdmin.id], remove: [] } });

    expect(assigned.response.status).toBe(200);
    expect(await storedRow(task.id)).toMatchObject({ assignedTo: [orgAdmin.id] });
  });

  it("answers 404 to a move into another organization's project and keeps the task", async () => {
    const task = await createTask();

    const moved = await update(admin, task.id, { projectId: foreignProject });

    expect(moved.response.status).toBe(404);
    expect((await storedRow(task.id)).projectId).toBe(projectA);
  });
});
