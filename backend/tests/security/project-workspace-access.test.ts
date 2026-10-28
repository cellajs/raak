import { and, eq } from 'drizzle-orm';
import {
  assignProjectWorkspace,
  createProjects,
  createWorkspaces,
  deleteProjects,
  deleteWorkspaces,
  getProject,
  getPublicProject,
  getWorkspace,
  moveProjectToWorkspace,
  removeProjectWorkspace,
  updateProject,
  updateWorkspace,
} from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { workspacesTable } from '#/modules/workspace/workspace-db';
import { adminRole, defaultHeaders, memberRole } from '../fixtures';
import { adminDb, type ErrorResponse, expectRefusal, refusalOf } from '../helpers';
import { createAppClient, type TestResult } from '../test-client';
import { setTestConfig } from '../test-utils';
import { clearSecurityTestData, createOrgUser, createSecondOrg, createTestTenant, type TestTenant } from './helpers';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

type User = { id: string; sessionCookie: string };
type Path = { tenantId: string; organizationId: string };
type Channel = { id: string; slug: string; name: string };

const notFound = { status: 404, type: 'not_found' };
const forbidden = { status: 403, type: 'forbidden' };

interface Row {
  route: string;
  /** The attempt on the caller's own tenant path, naming `id`. */
  attempt: (as: User, id: string) => Promise<TestResult>;
  /** Org B's id, which the caller may not reach on this path. */
  foreignId: () => string;
  /** An id that names nothing, in the same form. */
  missingId: () => string;
  refusal?: { status: number; type: string };
  unchanged?: () => Promise<void>;
}

/**
 * Projects and workspaces are channels, outside RLS: `getValidChannel` and `splitByPermission` compare a row with the
 * request's tenant and organization, and that comparison is their isolation. A row the caller may not read answers as
 * one that does not exist; a 403 is for an action denied on a row the caller reads.
 */
describe('Project and workspace access', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;
  let pathA: Path;
  let pathB: Path;
  let admin: User;
  let adminB: User;
  /** A member of org A and an admin of org B and of its project: org B's grants must not carry over to tenant A's path. */
  let insider: User;
  /** Org members of A: a workspace owner, a plain member, a workspace member and a project member and guest. */
  let owner: User;
  let orgMember: User;
  let workspaceMember: User;
  let projectMember: User;
  let projectGuest: User;
  let projectA: Channel;
  let publicProjectA: Channel;
  let workspaceA: Channel;
  let ownerWorkspace: Channel;
  let projectB: Channel;
  let workspaceB: Channel;

  const headers = (as?: User) => (as ? { ...defaultHeaders, Cookie: as.sessionCookie } : defaultHeaders);
  const unique = () => crypto.randomUUID().slice(0, 8);
  const randomSlug = () => `missing-${unique()}`;
  const tempId = () => `temp-${crypto.randomUUID()}`;
  const createdOf = (result: TestResult) => {
    expect(result.response.status).toBe(201);
    return (result.data as { data: Channel[] }).data[0];
  };

  const newWorkspace = async (path: Path, as: User) =>
    createdOf(await call(createWorkspaces, { path, body: [{ id: tempId(), name: `Home ${unique()}` }], headers: headers(as) }));
  const newProject = async (path: Path, as: User, workspaceId: string, isPublic = false) => {
    const body = [{ id: tempId(), name: `Project ${unique()}`, slug: `project-${unique()}`, public: isPublic }];
    return createdOf(await call(createProjects, { path, query: { workspaceId }, body, headers: headers(as) }));
  };

  const projectRow = async (id: string) => (await adminDb.select().from(projectsTable).where(eq(projectsTable.id, id)))[0];
  const workspaceRow = async (id: string) => (await adminDb.select().from(workspacesTable).where(eq(workspacesTable.id, id)))[0];
  const filedUnder = async (userId: string, projectId: string) =>
    (
      await adminDb
        .select({ workspaceId: membershipsTable.workspaceId })
        .from(membershipsTable)
        .where(and(eq(membershipsTable.userId, userId), eq(membershipsTable.channelType, 'project'), eq(membershipsTable.projectId, projectId)))
    )[0]?.workspaceId;

  const expectProjectKept = async ({ id, name }: Channel) => expect(await projectRow(id)).toMatchObject({ name });
  const expectWorkspaceKept = async ({ id, name }: Channel) => expect(await workspaceRow(id)).toMatchObject({ name });

  const membership = (user: User, path: Path, channel: { type: 'organization' | 'workspace' | 'project'; id: string }, role: string) => ({
    id: generateId(),
    tenantId: path.tenantId,
    organizationId: path.organizationId,
    userId: user.id,
    channelType: channel.type,
    channelId: channel.id,
    ...(channel.type === 'workspace' && { workspaceId: channel.id }),
    ...(channel.type === 'project' && { projectId: channel.id }),
    role: role as typeof adminRole,
    displayOrder: 1000,
    createdBy: user.id,
  });

  beforeAll(async () => {
    tenant = await createTestTenant(call, 'channel-access');
    pathA = { tenantId: tenant.tenantId, organizationId: tenant.organization.id };
    admin = { id: tenant.user.id, sessionCookie: tenant.sessionCookie };
    workspaceA = await newWorkspace(pathA, admin);
    projectA = await newProject(pathA, admin, workspaceA.id);
    publicProjectA = await newProject(pathA, admin, workspaceA.id, true);

    owner = await createOrgUser(call, pathA.tenantId, pathA.organizationId, 'channel-access-owner', memberRole);
    ownerWorkspace = await newWorkspace(pathA, owner);

    const orgB = await createSecondOrg();
    pathB = { tenantId: orgB.tenantId, organizationId: orgB.id };
    adminB = await createOrgUser(call, pathB.tenantId, pathB.organizationId, 'channel-access-b', adminRole);
    workspaceB = await newWorkspace(pathB, adminB);
    projectB = await newProject(pathB, adminB, workspaceB.id);

    // Memberships are seeded before their users' first request, so no session cache holds an older set.
    orgMember = await createOrgUser(call, pathA.tenantId, pathA.organizationId, 'channel-access-member', memberRole);
    workspaceMember = await createOrgUser(call, pathA.tenantId, pathA.organizationId, 'channel-access-ws-member', memberRole);
    projectMember = await createOrgUser(call, pathA.tenantId, pathA.organizationId, 'channel-access-p-member', memberRole);
    projectGuest = await createOrgUser(call, pathA.tenantId, pathA.organizationId, 'channel-access-p-guest', memberRole);
    insider = await createOrgUser(call, pathA.tenantId, pathA.organizationId, 'channel-access-insider', memberRole);
    await adminDb
      .insert(membershipsTable)
      .values([
        membership(workspaceMember, pathA, { type: 'workspace', id: ownerWorkspace.id }, 'member'),
        membership(projectMember, pathA, { type: 'project', id: projectA.id }, 'member'),
        membership(projectGuest, pathA, { type: 'project', id: projectA.id }, 'guest'),
        membership(insider, pathA, { type: 'project', id: projectA.id }, 'member'),
        membership(insider, pathB, { type: 'organization', id: pathB.organizationId }, adminRole),
        { ...membership(insider, pathB, { type: 'project', id: projectB.id }, 'admin'), workspaceId: workspaceB.id },
      ]);
  });

  afterAll(async () => await clearSecurityTestData());

  /** Every project and workspace route on `path`, naming org B's project and workspace. */
  const attemptsOn = (path: Path) => [
    { route: 'getProject', attempt: (as: User) => call(getProject, { path: { ...path, id: projectB.id }, headers: headers(as) }) },
    {
      route: 'getProject by slug',
      attempt: (as: User) => call(getProject, { path: { ...path, id: projectB.slug }, query: { slug: true }, headers: headers(as) }),
    },
    {
      route: 'updateProject',
      attempt: (as: User) => call(updateProject, { path: { ...path, id: projectB.id }, body: { name: 'Hijacked' }, headers: headers(as) }),
    },
    { route: 'deleteProjects', attempt: (as: User) => call(deleteProjects, { path, body: { ids: [projectB.id] }, headers: headers(as) }) },
    {
      route: 'assignProjectWorkspace',
      attempt: (as: User) =>
        call(assignProjectWorkspace, { path: { ...path, id: projectB.id }, query: { workspaceId: workspaceB.id }, headers: headers(as) }),
    },
    {
      route: 'moveProjectToWorkspace',
      attempt: (as: User) =>
        call(moveProjectToWorkspace, { path: { ...path, id: projectB.id }, query: { workspaceId: workspaceB.id }, headers: headers(as) }),
    },
    {
      route: 'removeProjectWorkspace',
      attempt: (as: User) => call(removeProjectWorkspace, { path: { ...path, id: projectB.id }, headers: headers(as) }),
    },
    {
      route: 'createProjects',
      attempt: (as: User) =>
        call(createProjects, {
          path,
          query: { workspaceId: workspaceB.id },
          body: [{ id: tempId(), name: 'Planted', slug: `planted-${unique()}`, public: false }],
          headers: headers(as),
        }),
    },
    { route: 'getWorkspace', attempt: (as: User) => call(getWorkspace, { path: { ...path, id: workspaceB.id }, headers: headers(as) }) },
    {
      route: 'updateWorkspace',
      attempt: (as: User) => call(updateWorkspace, { path: { ...path, id: workspaceB.id }, body: { name: 'Hijacked' }, headers: headers(as) }),
    },
    {
      route: 'deleteWorkspaces',
      attempt: (as: User) => call(deleteWorkspaces, { path, body: { ids: [workspaceB.id] }, headers: headers(as) }),
    },
  ];

  const expectOrgBKept = async () => {
    await expectProjectKept(projectB);
    await expectWorkspaceKept(workspaceB);
    expect(await filedUnder(insider.id, projectB.id)).toBe(workspaceB.id);
    expect(await adminDb.select().from(projectsTable).where(eq(projectsTable.name, 'Planted'))).toHaveLength(0);
  };

  it("must not reach org B's projects and workspaces via tenant B's path from tenant A", async () => {
    for (const { route, attempt } of attemptsOn(pathB)) await expectRefusal(await attempt(admin), forbidden.status, forbidden.type, route);
    await expectOrgBKept();
  });

  it("must not reach org B's projects and workspaces via org B on tenant A's path", async () => {
    const path = { tenantId: pathA.tenantId, organizationId: pathB.organizationId };
    for (const attacker of [admin, insider]) {
      for (const { route, attempt } of attemptsOn(path)) await expectRefusal(await attempt(attacker), notFound.status, notFound.type, route);
    }
    await expectOrgBKept();
  });

  /** Org B's ids on tenant A's own path: each answers as an id that names nothing. */
  const rows: Row[] = [
    {
      route: 'getProject',
      attempt: (as, id) => call(getProject, { path: { ...pathA, id }, headers: headers(as) }),
      foreignId: () => projectB.id,
      missingId: generateId,
    },
    {
      route: 'getProject by slug',
      attempt: (as, slug) => call(getProject, { path: { ...pathA, id: slug }, query: { slug: true }, headers: headers(as) }),
      foreignId: () => projectB.slug,
      missingId: randomSlug,
    },
    {
      route: 'updateProject',
      attempt: (as, id) => call(updateProject, { path: { ...pathA, id }, body: { name: 'Hijacked' }, headers: headers(as) }),
      foreignId: () => projectB.id,
      missingId: generateId,
      unchanged: () => expectProjectKept(projectB),
    },
    {
      route: 'deleteProjects',
      attempt: (as, id) => call(deleteProjects, { path: pathA, body: { ids: [id] }, headers: headers(as) }),
      foreignId: () => projectB.id,
      missingId: generateId,
      refusal: forbidden,
      unchanged: () => expectProjectKept(projectB),
    },
    {
      route: 'assignProjectWorkspace with a foreign project',
      attempt: (as, id) => call(assignProjectWorkspace, { path: { ...pathA, id }, query: { workspaceId: workspaceA.id }, headers: headers(as) }),
      foreignId: () => projectB.id,
      missingId: generateId,
      unchanged: async () => expect(await filedUnder(insider.id, projectB.id)).toBe(workspaceB.id),
    },
    {
      route: 'moveProjectToWorkspace with a foreign project',
      attempt: (as, id) => call(moveProjectToWorkspace, { path: { ...pathA, id }, query: { workspaceId: workspaceA.id }, headers: headers(as) }),
      foreignId: () => projectB.id,
      missingId: generateId,
      unchanged: async () => expect(await filedUnder(insider.id, projectB.id)).toBe(workspaceB.id),
    },
    {
      route: 'removeProjectWorkspace with a foreign project',
      attempt: (as, id) => call(removeProjectWorkspace, { path: { ...pathA, id }, headers: headers(as) }),
      foreignId: () => projectB.id,
      missingId: generateId,
      unchanged: async () => expect(await filedUnder(insider.id, projectB.id)).toBe(workspaceB.id),
    },
    {
      route: 'assignProjectWorkspace with a foreign workspace',
      attempt: (as, workspaceId) =>
        call(assignProjectWorkspace, { path: { ...pathA, id: projectA.id }, query: { workspaceId }, headers: headers(as) }),
      foreignId: () => workspaceB.id,
      missingId: generateId,
      unchanged: async () => {
        expect(await filedUnder(admin.id, projectA.id)).toBe(workspaceA.id);
        expect(await filedUnder(insider.id, projectA.id)).toBeNull();
      },
    },
    {
      route: 'moveProjectToWorkspace with a foreign workspace',
      attempt: (as, workspaceId) =>
        call(moveProjectToWorkspace, { path: { ...pathA, id: projectA.id }, query: { workspaceId }, headers: headers(as) }),
      foreignId: () => workspaceB.id,
      missingId: generateId,
      unchanged: async () => {
        expect(await filedUnder(admin.id, projectA.id)).toBe(workspaceA.id);
        expect(await filedUnder(insider.id, projectA.id)).toBeNull();
      },
    },
    {
      route: 'createProjects filed under a foreign workspace',
      attempt: (as, workspaceId) =>
        call(createProjects, {
          path: pathA,
          query: { workspaceId },
          body: [{ id: tempId(), name: 'Planted', slug: `planted-${unique()}`, public: false }],
          headers: headers(as),
        }),
      foreignId: () => workspaceB.id,
      missingId: generateId,
      unchanged: async () => expect(await adminDb.select().from(projectsTable).where(eq(projectsTable.name, 'Planted'))).toHaveLength(0),
    },
    {
      route: 'getWorkspace',
      attempt: (as, id) => call(getWorkspace, { path: { ...pathA, id }, headers: headers(as) }),
      foreignId: () => workspaceB.id,
      missingId: generateId,
    },
    {
      route: 'getWorkspace by slug',
      attempt: (as, slug) => call(getWorkspace, { path: { ...pathA, id: slug }, query: { slug: true }, headers: headers(as) }),
      foreignId: () => workspaceB.slug,
      missingId: randomSlug,
    },
    {
      route: 'updateWorkspace',
      attempt: (as, id) => call(updateWorkspace, { path: { ...pathA, id }, body: { name: 'Hijacked' }, headers: headers(as) }),
      foreignId: () => workspaceB.id,
      missingId: generateId,
      unchanged: () => expectWorkspaceKept(workspaceB),
    },
    {
      route: 'deleteWorkspaces',
      attempt: (as, id) => call(deleteWorkspaces, { path: pathA, body: { ids: [id] }, headers: headers(as) }),
      foreignId: () => workspaceB.id,
      missingId: generateId,
      refusal: forbidden,
      unchanged: () => expectWorkspaceKept(workspaceB),
    },
  ];

  it.each(rows)(
    "must not confirm org B's id via $route on tenant A's path",
    async ({ attempt, foreignId, missingId, refusal = notFound, unchanged }) => {
      // The insider reads org B's rows on tenant B's path; on tenant A's they answer as missing to it too.
      for (const attacker of [admin, insider]) {
        const foreign = await attempt(attacker, foreignId());
        const missing = await attempt(attacker, missingId());
        await expectRefusal(foreign, refusal.status, refusal.type);
        expect(refusalOf(foreign.error as ErrorResponse)).toEqual(refusalOf(missing.error as ErrorResponse));
      }
      await unchanged?.();
    },
  );

  it("reaches org B's project and workspace on tenant B's path (positive control)", async () => {
    for (const as of [adminB, insider]) {
      expect((await call(getProject, { path: { ...pathB, id: projectB.id }, headers: headers(as) })).response.status).toBe(200);
      expect((await call(getWorkspace, { path: { ...pathB, id: workspaceB.id }, headers: headers(as) })).response.status).toBe(200);
    }
  });

  it('must not update or delete a project via an org member, a project member or a project guest', async () => {
    for (const attacker of [orgMember, projectMember, projectGuest]) {
      // Each reads the project, so the refusal is the action's.
      expect((await call(getProject, { path: { ...pathA, id: projectA.id }, headers: headers(attacker) })).response.status).toBe(200);
      const update = await call(updateProject, { path: { ...pathA, id: projectA.id }, body: { name: 'Hijacked' }, headers: headers(attacker) });
      await expectRefusal(update, forbidden.status, forbidden.type);
      const remove = await call(deleteProjects, { path: pathA, body: { ids: [projectA.id] }, headers: headers(attacker) });
      await expectRefusal(remove, forbidden.status, forbidden.type);
    }
    await expectProjectKept(projectA);
  });

  it("must not update or delete another user's workspace via an org member or a workspace member", async () => {
    for (const attacker of [orgMember, workspaceMember]) {
      const path = { ...pathA, id: ownerWorkspace.id };
      const update = await call(updateWorkspace, { path, body: { name: 'Hijacked' }, headers: headers(attacker) });
      await expectRefusal(update, forbidden.status, forbidden.type);
      const remove = await call(deleteWorkspaces, { path: pathA, body: { ids: [ownerWorkspace.id] }, headers: headers(attacker) });
      await expectRefusal(remove, forbidden.status, forbidden.type);
    }
    await expectWorkspaceKept(ownerWorkspace);
  });

  it('must not confirm a private or unpublished project via getPublicProject, anonymous or signed in to another org', async () => {
    const draftId = generateId();
    const draft = { id: draftId, slug: `draft-${draftId.slice(0, 8)}` };
    await adminDb.insert(projectsTable).values({ ...pathA, ...draft, name: 'Draft', public: true, publishedAt: null, createdBy: admin.id });

    for (const as of [undefined, adminB]) {
      const read = (id: string, slug?: boolean) => call(getPublicProject, { path: { id }, query: slug ? { slug } : {}, headers: headers(as) });
      const missingById = await read(generateId());
      const missingBySlug = await read(randomSlug(), true);
      for (const hidden of [projectA, draft]) {
        for (const [answer, missing] of [
          [await read(hidden.id), missingById],
          [await read(hidden.slug, true), missingBySlug],
        ]) {
          await expectRefusal(answer, notFound.status, notFound.type);
          expect(answer.error).not.toHaveProperty('meta');
          expect(refusalOf(answer.error as ErrorResponse)).toEqual(refusalOf(missing.error as ErrorResponse));
        }
      }
      // Positive control: a published public project reads, by id and by slug.
      expect((await read(publicProjectA.id)).response.status).toBe(200);
      expect((await read(publicProjectA.slug, true)).response.status).toBe(200);
    }
  });

  it('must not read a public project or its workspace via the signed-in route without a session', async () => {
    for (const answer of [
      await call(getProject, { path: { ...pathA, id: publicProjectA.id }, headers: headers() }),
      await call(getWorkspace, { path: { ...pathA, id: workspaceA.id }, headers: headers() }),
    ]) {
      expect(answer.response.status).toBe(401);
      expect(answer.data).toBeUndefined();
    }
  });

  it('updates and deletes for the project admin and the workspace owner (positive control)', async () => {
    const update = await call(updateProject, { path: { ...pathA, id: projectA.id }, body: { name: 'Renamed' }, headers: headers(admin) });
    expect(update.response.status).toBe(200);
    const rename = await call(updateWorkspace, { path: { ...pathA, id: ownerWorkspace.id }, body: { name: 'Renamed' }, headers: headers(owner) });
    expect(rename.response.status).toBe(200);

    expect((await call(deleteProjects, { path: pathA, body: { ids: [projectA.id] }, headers: headers(admin) })).response.status).toBe(200);
    expect((await call(deleteWorkspaces, { path: pathA, body: { ids: [ownerWorkspace.id] }, headers: headers(owner) })).response.status).toBe(200);
    expect(await projectRow(projectA.id)).toBeUndefined();
    expect(await workspaceRow(ownerWorkspace.id)).toBeUndefined();
  });
});
