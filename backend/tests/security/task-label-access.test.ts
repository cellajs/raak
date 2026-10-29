import { asc, eq } from 'drizzle-orm';
import {
  createLabels,
  createTasks,
  deleteLabels,
  deleteTasks,
  getLabel,
  getLabels,
  getPublicTask,
  getPublicTasks,
  getTask,
  getTasks,
  updateLabel,
  updateTask,
} from 'sdk';
import type { EntityRole } from 'shared';
import { generateId } from 'shared/utils/entity-id';
import { nanoid } from 'shared/utils/nanoid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { labelsTable } from '#/modules/label/label-db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { usersTable } from '#/modules/user/user-db';
import { mockStxBase, mockStxFor } from '#/schemas/sync-transaction-mocks';
import { adminRole, defaultHeaders, memberRole } from '../fixtures';
import { adminDb, createTestOrganization, type ErrorResponse, expectRefusal, refusalOf } from '../helpers';
import { createAppClient, type TestResult } from '../test-client';
import { setTestConfig } from '../test-utils';
import { clearSecurityTestData, createOrgUser } from './helpers';
import { createApiProject } from './helpers-app';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

type User = { id: string; sessionCookie: string };
type Path = { tenantId: string; organizationId: string };
type Refusal = { status: number; type: string };
/** Where an attempt aims: the URL's tenant and organization, and the ids it names. */
type Target = { path: Path; projectId: string; taskId: string; labelId: string };
type HydratedTask = { id: string; labels: { id: string; projectId: string }[]; assignedTo: { id: string }[] };

const notFound = { status: 404, type: 'not_found' };
const forbidden = { status: 403, type: 'forbidden' };

/**
 * Tasks and labels live in a project. Org A holds a private project with an admin (the org admin who created it), a
 * project member, a project guest, an org member outside the project, and a member of both organizations who is an
 * admin of org B; org B (its own tenant) holds a project with a task and a label of its own.
 */
describe('Task and label access', async () => {
  const call = await createAppClient();
  const headers = (as?: User) => (as ? { ...defaultHeaders, Cookie: as.sessionCookie } : defaultHeaders);

  let pathA: Path;
  let pathB: Path;
  let adminA: User;
  let member: User;
  let guest: User;
  let outsider: User;
  let insider: User;
  let adminB: User & { name: string };
  /** Org A's private project, a second one (the member is a guest there, the guest a member), and a public one. */
  let projectA: string;
  let projectA2: string;
  let publicProject: string;
  let taskA: string;
  let labelA: string;
  let primaryA: string;
  let primaryB: string;
  let publicLabel: string;
  let workspaceB: string;
  let targetA: Target;
  let targetB: Target;

  const firstId = (result: TestResult) => String((result.data as { data: { id: string }[] } | undefined)?.data[0].id);

  const join = async (path: Path, channelType: 'organization' | 'project', channelId: string, userId: string, role: EntityRole) => {
    await adminDb.insert(membershipsTable).values({
      id: generateId(),
      tenantId: path.tenantId,
      organizationId: path.organizationId,
      channelType,
      channelId,
      ...(channelType === 'project' && { projectId: channelId }),
      userId,
      role,
      displayOrder: 2,
      createdBy: userId,
    });
    invalidateCache.user(userId);
  };

  const taskBody = (projectId: string, fields: Record<string, unknown> = {}) => ({
    id: generateId(),
    name: 'Task',
    description: null,
    projectId,
    status: TaskStatus.Unstarted,
    stx: mockStxBase(),
    ...fields,
  });
  const labelBody = (projectId: string, fields: Record<string, unknown> = {}) => ({
    id: generateId(),
    name: `tag-${nanoid(6).toLowerCase()}`,
    color: null,
    projectId,
    stx: mockStxBase(),
    ...fields,
  });
  const deleteStx = () => ({ mutationId: generateId(), sourceId: 'task-label-access' });

  const newTask = async (path: Path, as: User, projectId: string, fields: Record<string, unknown> = {}) => {
    const created = await call(createTasks, { path, body: [taskBody(projectId, fields)], headers: headers(as) });
    expect(created.response.status).toBe(201);
    return (created.data as { data: HydratedTask[] }).data[0];
  };
  const newLabel = async (path: Path, as: User, projectId: string, fields: Record<string, unknown> = {}) => {
    const created = await call(createLabels, { path, body: [labelBody(projectId, fields)], headers: headers(as) });
    expect(created.response.status).toBe(201);
    return firstId(created);
  };

  const firstPrimary = async (path: Path, projectId: string, as: User) => {
    const { data } = await call(getLabels, { path, query: { projectId, modes: 'primary' }, headers: headers(as) });
    return (data as { items: { id: string }[] }).items[0].id;
  };

  /** Every task and label row of an organization: a refused attempt leaves all of them as they were. */
  const rowsOf = async (organizationId: string) => ({
    tasks: await adminDb.select().from(tasksTable).where(eq(tasksTable.organizationId, organizationId)).orderBy(asc(tasksTable.id)),
    labels: await adminDb.select().from(labelsTable).where(eq(labelsTable.organizationId, organizationId)).orderBy(asc(labelsTable.id)),
  });

  /** The ten task and label routes, each aimed at a target. */
  const attempts = {
    getTasks: (t: Target, as: User) => call(getTasks, { path: t.path, query: { projectId: t.projectId }, headers: headers(as) }),
    getTask: (t: Target, as: User) => call(getTask, { path: { ...t.path, id: t.taskId }, headers: headers(as) }),
    createTasks: (t: Target, as: User) => call(createTasks, { path: t.path, body: [taskBody(t.projectId)], headers: headers(as) }),
    updateTask: (t: Target, as: User) =>
      call(updateTask, { path: { ...t.path, id: t.taskId }, body: { ops: { name: 'Hijacked' }, stx: mockStxFor('name') }, headers: headers(as) }),
    deleteTasks: (t: Target, as: User) => call(deleteTasks, { path: t.path, body: { ids: [t.taskId], stx: deleteStx() }, headers: headers(as) }),
    getLabels: (t: Target, as: User) => call(getLabels, { path: t.path, query: { projectId: t.projectId }, headers: headers(as) }),
    getLabel: (t: Target, as: User) => call(getLabel, { path: { ...t.path, id: t.labelId }, headers: headers(as) }),
    createLabels: (t: Target, as: User) => call(createLabels, { path: t.path, body: [labelBody(t.projectId)], headers: headers(as) }),
    updateLabel: (t: Target, as: User) =>
      call(updateLabel, { path: { ...t.path, id: t.labelId }, body: { ops: { name: 'hijacked' }, stx: mockStxFor('name') }, headers: headers(as) }),
    deleteLabels: (t: Target, as: User) => call(deleteLabels, { path: t.path, body: { ids: [t.labelId], stx: deleteStx() }, headers: headers(as) }),
  };
  type Route = keyof typeof attempts;

  beforeAll(async () => {
    const orgA = await createTestOrganization();
    pathA = { tenantId: orgA.tenantId, organizationId: orgA.id };
    adminA = await createOrgUser(call, orgA.tenantId, orgA.id, 'task-access-admin-a', adminRole);
    member = await createOrgUser(call, orgA.tenantId, orgA.id, 'task-access-member', memberRole);
    guest = await createOrgUser(call, orgA.tenantId, orgA.id, 'task-access-guest', memberRole);
    outsider = await createOrgUser(call, orgA.tenantId, orgA.id, 'task-access-outsider', memberRole);
    insider = await createOrgUser(call, orgA.tenantId, orgA.id, 'task-access-insider', memberRole);

    ({ projectId: projectA } = await createApiProject(call, pathA, adminA));
    ({ projectId: projectA2 } = await createApiProject(call, pathA, adminA));
    ({ projectId: publicProject } = await createApiProject(call, pathA, adminA, true));
    await join(pathA, 'project', projectA, member.id, 'member');
    await join(pathA, 'project', projectA, guest.id, 'guest');
    await join(pathA, 'project', projectA, insider.id, 'member');
    await join(pathA, 'project', projectA2, member.id, 'guest');
    await join(pathA, 'project', projectA2, guest.id, 'member');

    taskA = (await newTask(pathA, adminA, projectA)).id;
    labelA = await newLabel(pathA, adminA, projectA);
    publicLabel = await newLabel(pathA, adminA, publicProject);
    primaryA = await firstPrimary(pathA, projectA, adminA);

    const orgB = await createTestOrganization();
    pathB = { tenantId: orgB.tenantId, organizationId: orgB.id };
    const userB = await createOrgUser(call, orgB.tenantId, orgB.id, 'task-access-admin-b', adminRole);
    const [{ name }] = await adminDb.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userB.id));
    adminB = { ...userB, name };
    const homeB = await createApiProject(call, pathB, adminB);
    workspaceB = homeB.workspaceId;
    primaryB = await firstPrimary(pathB, homeB.projectId, adminB);
    await join(pathB, 'organization', orgB.id, insider.id, adminRole);

    targetA = { path: pathA, projectId: projectA, taskId: taskA, labelId: labelA };
    targetB = {
      path: pathB,
      projectId: homeB.projectId,
      taskId: (await newTask(pathB, adminB, homeB.projectId)).id,
      labelId: await newLabel(pathB, adminB, homeB.projectId),
    };
  });

  afterAll(async () => await clearSecurityTestData());

  describe('Across tenants and organizations', () => {
    const routes = Object.keys(attempts) as Route[];

    it.each(routes)("must not reach org B's rows via %s on tenant B's path or org B on tenant A's path", async (route) => {
      const before = await rowsOf(pathB.organizationId);

      // Tenant B's own path: the tenant guard refuses a user of tenant A.
      await expectRefusal(await attempts[route](targetB, adminA), forbidden.status, forbidden.type);
      // Org B on tenant A's path: the organization resolves inside the URL's tenant, also for an admin of org B.
      const crossed = { ...targetB, path: { tenantId: pathA.tenantId, organizationId: pathB.organizationId } };
      for (const attacker of [adminA, insider]) await expectRefusal(await attempts[route](crossed, attacker), notFound.status, notFound.type);

      expect(await rowsOf(pathB.organizationId)).toEqual(before);
    });

    /**
     * Org B's ids on tenant A's own path, by the member of both organizations: an admin of org B holds every grant on
     * those rows, so the request scope is all that stands between.
     */
    const foreignIdRows: { route: Route; refusal: Refusal }[] = [
      { route: 'getTasks', refusal: notFound },
      { route: 'getTask', refusal: notFound },
      { route: 'createTasks', refusal: notFound },
      { route: 'updateTask', refusal: notFound },
      { route: 'deleteTasks', refusal: forbidden },
      { route: 'getLabels', refusal: notFound },
      { route: 'getLabel', refusal: notFound },
      { route: 'createLabels', refusal: notFound },
      { route: 'updateLabel', refusal: notFound },
      { route: 'deleteLabels', refusal: forbidden },
    ];

    it.each(foreignIdRows)("must not reach org B's rows via $route naming their ids on tenant A's path", async ({ route, refusal }) => {
      const before = await rowsOf(pathB.organizationId);
      await expectRefusal(await attempts[route]({ ...targetB, path: pathA }, insider), refusal.status, refusal.type);
      expect(await rowsOf(pathB.organizationId)).toEqual(before);
    });

    it("must not list org B's tasks or labels via its workspace on tenant A's path", async () => {
      for (const route of [getTasks, getLabels]) {
        const { data, response } = await call(route, { path: pathA, query: { workspaceId: workspaceB }, headers: headers(insider) });
        expect(response.status).toBe(200);
        expect(data).toMatchObject({ items: [], total: 0 });
      }
    });

    it("must not move a task into org B's project, even for an admin of org B", async () => {
      const own = await newTask(pathA, insider, projectA);
      const before = await rowsOf(pathB.organizationId);

      const moved = await call(updateTask, {
        path: { ...pathA, id: own.id },
        body: { ops: { projectId: targetB.projectId }, stx: mockStxFor('projectId') },
        headers: headers(insider),
      });

      await expectRefusal(moved, notFound.status, notFound.type);
      expect((await adminDb.select().from(tasksTable).where(eq(tasksTable.id, own.id)))[0]).toMatchObject({ projectId: projectA, ...pathA });
      expect(await rowsOf(pathB.organizationId)).toEqual(before);
    });

    it("must not return or take over org B's rows via a create that reuses their ids", async () => {
      const before = await rowsOf(pathB.organizationId);
      // An id the caller wrote before reads as a replay of that create: an id of another organization's row must not.
      for (const [route, body] of [
        [createTasks, taskBody(projectA, { id: targetB.taskId })],
        [createLabels, labelBody(projectA, { id: targetB.labelId })],
      ] as const) {
        const { data, response } = await call(route, { path: pathA, body: [body] as never, headers: headers(insider) });
        expect(response.status).toBe(200);
        expect(data).toEqual({ data: [], rejectedIds: [body.id] });
      }
      expect(await rowsOf(pathB.organizationId)).toEqual(before);
    });

    it("must not delete org B's row via a batch on tenant A's path that also names the caller's own", async () => {
      for (const [route, foreignId, ownId] of [
        [deleteTasks, targetB.taskId, (await newTask(pathA, insider, projectA)).id],
        [deleteLabels, targetB.labelId, await newLabel(pathA, insider, projectA)],
      ] as const) {
        const before = await rowsOf(pathB.organizationId);
        const { data, response } = await call(route, { path: pathA, body: { ids: [ownId, foreignId], stx: deleteStx() }, headers: headers(insider) });
        expect(response.status).toBe(200);
        expect((data as { rejectedIds: string[] }).rejectedIds).toEqual([foreignId]);
        expect(await rowsOf(pathB.organizationId)).toEqual(before);
      }
    });

    it.each(['getTask', 'getLabel'] as const)(
      "must not serve org B's row via %s on tenant A's path from a cache its own path warmed",
      async (route) => {
        expect((await attempts[route](targetB, insider)).response.status).toBe(200);
        await expectRefusal(await attempts[route]({ ...targetB, path: pathA }, insider), notFound.status, notFound.type);
      },
    );
  });

  describe('Project roles', () => {
    type Attempt = (as: User) => Promise<TestResult>;
    const onA =
      (route: Route): Attempt =>
      (as) =>
        attempts[route](targetA, as);
    const moveIntoA2: Attempt = (as) =>
      call(updateTask, {
        path: { ...pathA, id: taskA },
        body: { ops: { projectId: projectA2 }, stx: mockStxFor('projectId') },
        headers: headers(as),
      });
    const createLabelOfMode =
      (mode: 'primary' | 'epic'): Attempt =>
      (as) =>
        call(createLabels, { path: pathA, body: [labelBody(projectA, { mode })], headers: headers(as) });
    const row = (actor: () => User, act: string, attempt: Attempt, refusal: Refusal) => ({ actor, act, attempt, refusal });
    const [byOutsider, byGuest, byMember] = [() => outsider, () => guest, () => member];

    const rows = [
      // An organization member outside the project: neither tasks nor labels exist for them.
      row(byOutsider, 'an org member outside the project read a task', onA('getTask'), notFound),
      row(byOutsider, 'an org member outside the project create a task', onA('createTasks'), forbidden),
      row(byOutsider, 'an org member outside the project update a task', onA('updateTask'), notFound),
      row(byOutsider, 'an org member outside the project delete a task', onA('deleteTasks'), forbidden),
      row(byOutsider, 'an org member outside the project read a label', onA('getLabel'), notFound),
      row(byOutsider, 'an org member outside the project create a label', onA('createLabels'), forbidden),
      row(byOutsider, 'an org member outside the project update a label', onA('updateLabel'), notFound),
      row(byOutsider, 'an org member outside the project delete a label', onA('deleteLabels'), forbidden),
      // A project guest reads tasks only.
      row(byGuest, 'a project guest create a task', onA('createTasks'), forbidden),
      row(byGuest, 'a project guest update a task', onA('updateTask'), forbidden),
      row(byGuest, 'a project guest delete a task', onA('deleteTasks'), forbidden),
      row(byGuest, 'a project guest move a task into a project they are a member of', moveIntoA2, forbidden),
      row(byGuest, 'a project guest read a label', onA('getLabel'), notFound),
      row(byGuest, 'a project guest create a label', onA('createLabels'), forbidden),
      row(byGuest, 'a project guest update a label', onA('updateLabel'), notFound),
      row(byGuest, 'a project guest delete a label', onA('deleteLabels'), forbidden),
      // A project member: tasks and tags, but the project's task types and epics are the project admin's.
      row(byMember, 'a project member move a task into a project they are a guest of', moveIntoA2, forbidden),
      row(byMember, 'a project member create a primary label', createLabelOfMode('primary'), forbidden),
      row(byMember, 'a project member create an epic label', createLabelOfMode('epic'), forbidden),
    ];

    it.each(rows)('must not let $act', async ({ actor, attempt, refusal }) => {
      const before = await rowsOf(pathA.organizationId);
      await expectRefusal(await attempt(actor()), refusal.status, refusal.type);
      expect(await rowsOf(pathA.organizationId)).toEqual(before);
    });

    it.each([
      ['an org member outside the project', byOutsider],
      ['a project guest', byGuest],
    ] as const)("must not list the project's labels to %s", async (_, actor) => {
      await expectRefusal(await attempts.getLabels(targetA, actor()), notFound.status, notFound.type);

      const { data, response } = await call(getLabels, { path: pathA, headers: headers(actor()) });
      expect(response.status).toBe(200);
      expect((data as { items: { projectId: string }[] }).items.map(({ projectId }) => projectId)).not.toContain(projectA);
    });

    it("must not list the project's tasks to an org member outside it", async () => {
      for (const query of [{ projectId: projectA }, {}]) {
        const { data, response } = await call(getTasks, { path: pathA, query, headers: headers(outsider) });
        expect(response.status).toBe(200);
        expect(data).toMatchObject({ items: [], total: 0 });
      }
    });

    it("must not let a project member delete one of the project's primary labels", async () => {
      const before = await rowsOf(pathA.organizationId);
      const { data, response } = await call(deleteLabels, { path: pathA, body: { ids: [primaryA], stx: deleteStx() }, headers: headers(member) });
      expect(response.status).toBe(200);
      expect((data as { rejectedIds: string[] }).rejectedIds).toEqual([primaryA]);
      expect(await rowsOf(pathA.organizationId)).toEqual(before);
    });

    it('lets each role do what it holds (positive controls)', async () => {
      expect((await attempts.getTask(targetA, guest)).response.status).toBe(200);
      expect((await attempts.getTasks(targetA, guest)).data).toMatchObject({
        items: expect.arrayContaining([expect.objectContaining({ id: taskA })]),
      });
      expect((await attempts.createTasks(targetA, member)).response.status).toBe(201);
      expect((await attempts.getLabel(targetA, member)).response.status).toBe(200);
      expect((await attempts.createLabels(targetA, member)).response.status).toBe(201);
      for (const mode of ['primary', 'epic'] as const) expect((await createLabelOfMode(mode)(adminA)).response.status, mode).toBe(201);
      const { data } = await call(deleteLabels, { path: pathA, body: { ids: [primaryA], stx: deleteStx() }, headers: headers(adminA) });
      expect((data as { rejectedIds: string[] }).rejectedIds).toEqual([]);
    });
  });

  /**
   * A row the caller may not read answers as one that does not exist: the same status and body for an id of the
   * caller's organization they may not read, an id of another organization, and an id that names nothing.
   */
  describe('Existence', () => {
    const routes: Route[] = ['getTask', 'updateTask', 'deleteTasks', 'getLabel', 'updateLabel', 'deleteLabels'];

    it.each(routes)('must not confirm a task or label id via %s to a caller who may not read it', async (route) => {
      const answers = [
        await attempts[route](targetA, outsider),
        await attempts[route]({ ...targetA, taskId: targetB.taskId, labelId: targetB.labelId }, outsider),
        await attempts[route]({ ...targetA, taskId: generateId(), labelId: generateId() }, outsider),
      ].map(({ response, error }) => ({ ...refusalOf(error as ErrorResponse), status: response.status }));

      expect(answers[0].status).toBe(route.startsWith('delete') ? 403 : 404);
      expect(answers[1]).toEqual(answers[0]);
      expect(answers[2]).toEqual(answers[0]);
    });

    it('must not confirm a private task id via the anonymous public read', async () => {
      const [existing, missing] = await Promise.all(
        [taskA, generateId()].map(async (id) => {
          const { response, error } = await call(getPublicTask, { path: { id }, headers: headers() });
          return { ...refusalOf(error as ErrorResponse), status: response.status };
        }),
      );
      expect(existing.status).toBe(404);
      expect(existing).toEqual(missing);
    });
  });

  describe('Anonymous reads', () => {
    const publicList = async (projectId: string, query: Record<string, unknown> = {}) => {
      const { data, response } = await call(getPublicTasks, { query: { projectId, ...query } as never, headers: headers() });
      expect(response.status).toBe(200);
      return (data as { items: HydratedTask[] }).items;
    };

    it("must not hydrate another project's labels or another tenant's users into a public task", async () => {
      const task = await newTask(pathA, adminA, publicProject, {
        labels: [publicLabel, labelA, targetB.labelId],
        assignedTo: [adminA.id, outsider.id, adminB.id],
      });

      const read = await call(getPublicTask, { path: { id: task.id }, headers: headers() });
      expect(read.response.status).toBe(200);
      const listed = (await publicList(publicProject)).find(({ id }) => id === task.id);

      for (const served of [read.data as HydratedTask, listed]) {
        expect(served?.labels.map(({ id }) => id)).toEqual([publicLabel]);
        expect(served?.assignedTo.map(({ id }) => id)).toEqual([adminA.id]);
        expect(JSON.stringify(served)).not.toContain(adminB.id);
      }
    });

    it('must not serve a private or deleted task through the public list, whatever its query', async () => {
      const gone = await newTask(pathA, adminA, publicProject, { name: 'Secret plan' });
      // A range read would include deleted rows and a workspace would widen the projects: the public list takes neither.
      const steer = { afterSeq: 0, untilSeq: 2_000_000_000, workspaceId: generateId() };
      expect((await publicList(publicProject, steer)).map(({ id }) => id)).toContain(gone.id);

      const deleted = await call(deleteTasks, { path: pathA, body: { ids: [gone.id], stx: deleteStx() }, headers: headers(adminA) });
      expect(deleted.response.status).toBe(200);

      expect((await publicList(publicProject, steer)).map(({ id }) => id)).not.toContain(gone.id);
      expect(await publicList(projectA, steer)).toEqual([]);
      await expectRefusal(await call(getPublicTask, { path: { id: gone.id }, headers: headers() }), notFound.status, notFound.type);
    });
  });

  describe('Relation ids', () => {
    /** The task as the response and the row hold it: neither may name tenant B's user or labels. */
    const expectNoTenantB = async (served: unknown, taskId: string) => {
      const [row] = await adminDb.select().from(tasksTable).where(eq(tasksTable.id, taskId));
      expect({ assignedTo: row.assignedTo, labels: row.labels }).toEqual({ assignedTo: [], labels: [] });
      expect(row.primaryLabelId).not.toBe(primaryB);
      for (const leak of [adminB.id, adminB.name, targetB.labelId, primaryB]) expect(JSON.stringify(served)).not.toContain(leak);
    };

    it("must not store or hydrate another tenant's user, label or primary label named by a task create", async () => {
      const task = await newTask(pathA, member, projectA, { assignedTo: [adminB.id], labels: [targetB.labelId], primaryLabelId: primaryB });
      await expectNoTenantB(task, task.id);
    });

    it("must not store or hydrate another tenant's user or label named by a task update", async () => {
      const task = await newTask(pathA, member, projectA);
      const updated = await call(updateTask, {
        path: { ...pathA, id: task.id },
        query: { fullResponse: true },
        body: { ops: { assignedTo: { add: [adminB.id], remove: [] }, labels: { add: [targetB.labelId], remove: [] } }, stx: mockStxFor() },
        headers: headers(member),
      });
      expect(updated.response.status).toBe(200);
      await expectNoTenantB(updated.data, task.id);
    });
  });
});
