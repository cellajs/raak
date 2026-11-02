import { and, eq, inArray } from 'drizzle-orm';
import { assignProjectWorkspace, createProjects, createWorkspaces, deleteWorkspaces, handleMembershipInvitation, membershipInvite } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterEach, describe, expect, it } from 'vitest';
import { inactiveMembershipsTable } from '#/modules/memberships/inactive-memberships-db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { workspacesTable } from '#/modules/workspace/workspace-db';
import { adminRole, defaultHeaders, memberRole } from './fixtures';
import { adminDb, createTestOrganization, createTestSession, createTestUser } from './helpers';
import { clearSecurityTestData, createOrgUser } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

describe('Filing projects under workspaces', async () => {
  const call = await createAppClient();

  afterEach(async () => await clearSecurityTestData());

  type Created = { data: { id: string }[] } | undefined;
  const createdId = (result: { data?: unknown }) => (result.data as Created)?.data[0]?.id ?? '';

  async function orgWithUsers() {
    const org = await createTestOrganization();
    const label = crypto.randomUUID().slice(0, 8);
    const admin = await createOrgUser(call, org.tenantId, org.id, `admin-${label}`, adminRole);
    const member = await createOrgUser(call, org.tenantId, org.id, `member-${label}`, memberRole);
    const path = { tenantId: org.tenantId, organizationId: org.id };
    const headersOf = (user: { sessionCookie: string }) => ({ ...defaultHeaders, Cookie: user.sessionCookie });
    return { org, admin, member, path, headersOf };
  }

  async function createWorkspace(path: { tenantId: string; organizationId: string }, headers: Record<string, string>) {
    return createdId(await call(createWorkspaces, { path, body: [{ id: `temp-${crypto.randomUUID()}`, name: 'Home' }], headers }));
  }

  async function createProject(path: { tenantId: string; organizationId: string }, headers: Record<string, string>, workspaceId: string) {
    const body = [{ id: `temp-${crypto.randomUUID()}`, name: 'Alpha', slug: `alpha-${crypto.randomUUID().slice(0, 8)}`, public: false }];
    return createdId(await call(createProjects, { path, query: { workspaceId }, body, headers }));
  }

  const projectMembershipsOf = (userId: string, projectId: string) =>
    adminDb
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.userId, userId), eq(membershipsTable.channelType, 'project'), eq(membershipsTable.projectId, projectId)));

  const workspacesHeldBy = (userId: string) =>
    adminDb
      .select({ id: workspacesTable.id, name: workspacesTable.name, role: membershipsTable.role, archived: membershipsTable.archived })
      .from(membershipsTable)
      .innerJoin(workspacesTable, eq(workspacesTable.id, membershipsTable.channelId))
      .where(and(eq(membershipsTable.userId, userId), eq(membershipsTable.channelType, 'workspace')));

  async function addDirectly(path: { tenantId: string; organizationId: string }, headers: Record<string, string>, projectId: string, email: string) {
    const { response } = await call(membershipInvite, {
      path,
      query: { entityId: projectId, entityType: 'project' },
      body: { emails: [email], role: 'member' },
      headers,
    });
    expect(response.status).toBe(200);
  }

  /** An invitation to the project, bound to an account that is not in the organization yet. */
  async function inviteToProject(org: { id: string; tenantId: string }, projectId: string, user: { id: string; email: string }, createdBy: string) {
    const [invitation] = await adminDb
      .insert(inactiveMembershipsTable)
      .values({
        id: generateId(),
        email: user.email,
        userId: user.id,
        channelType: 'project',
        channelId: projectId,
        projectId,
        organizationId: org.id,
        tenantId: org.tenantId,
        role: 'member',
        createdBy,
      })
      .returning();
    return invitation.id;
  }

  const accept = (id: string, sessionCookie: string) =>
    call(handleMembershipInvitation, { path: { id, acceptOrReject: 'accept' }, headers: { ...defaultHeaders, Cookie: sessionCookie } });

  it('files a direct add under a new workspace named after the organization, when the person has none', async () => {
    const { org, admin, member, path, headersOf } = await orgWithUsers();
    const projectId = await createProject(path, headersOf(admin), await createWorkspace(path, headersOf(admin)));

    await addDirectly(path, headersOf(admin), projectId, member.email);

    const held = await workspacesHeldBy(member.id);
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ name: org.name, role: 'admin' });
    const [membership] = await projectMembershipsOf(member.id, projectId);
    expect(membership.workspaceId).toBe(held[0].id);
  });

  it("files a direct add under the person's first unarchived workspace", async () => {
    const { admin, member, path, headersOf } = await orgWithUsers();
    const projectId = await createProject(path, headersOf(admin), await createWorkspace(path, headersOf(admin)));
    const archivedId = await createWorkspace(path, headersOf(member));
    const firstUnarchivedId = await createWorkspace(path, headersOf(member));
    await createWorkspace(path, headersOf(member));
    await adminDb.update(membershipsTable).set({ archived: true }).where(eq(membershipsTable.channelId, archivedId));

    await addDirectly(path, headersOf(admin), projectId, member.email);

    expect((await workspacesHeldBy(member.id)).length).toBe(3);
    const [membership] = await projectMembershipsOf(member.id, projectId);
    expect(membership.workspaceId).toBe(firstUnarchivedId);
  });

  it('creates a workspace rather than file a direct add under an archived one', async () => {
    const { admin, member, path, headersOf } = await orgWithUsers();
    const projectId = await createProject(path, headersOf(admin), await createWorkspace(path, headersOf(admin)));
    const archivedId = await createWorkspace(path, headersOf(member));
    await adminDb.update(membershipsTable).set({ archived: true }).where(eq(membershipsTable.channelId, archivedId));

    await addDirectly(path, headersOf(admin), projectId, member.email);

    const [membership] = await projectMembershipsOf(member.id, projectId);
    expect(membership.workspaceId).not.toBe(archivedId);
    expect(await workspacesHeldBy(member.id)).toContainEqual(expect.objectContaining({ id: membership.workspaceId, archived: false }));
  });

  it('files an accepted invitation, bringing the organization membership along, and reuses the workspace for the next', async () => {
    const { org, admin, path, headersOf } = await orgWithUsers();
    const workspaceId = await createWorkspace(path, headersOf(admin));
    const firstProjectId = await createProject(path, headersOf(admin), workspaceId);
    const secondProjectId = await createProject(path, headersOf(admin), workspaceId);
    const invited = await createTestUser(`invited-${crypto.randomUUID().slice(0, 8)}@example.com`);
    const cookie = await createTestSession(invited);

    const first = await accept(await inviteToProject(org, firstProjectId, invited, admin.id), cookie);
    expect(first.response.status).toBe(200);
    const second = await accept(await inviteToProject(org, secondProjectId, invited, admin.id), await createTestSession(invited));
    expect(second.response.status).toBe(200);

    const held = await workspacesHeldBy(invited.id);
    expect(held).toHaveLength(1);
    const memberships = await adminDb
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.userId, invited.id), inArray(membershipsTable.channelId, [org.id, firstProjectId, secondProjectId])));
    expect(memberships).toHaveLength(3);
    for (const membership of memberships.filter(({ channelType }) => channelType === 'project')) {
      expect(membership.workspaceId).toBe(held[0].id);
    }
  });

  it('creates one workspace for two invitations accepted at once', async () => {
    const { org, admin, path, headersOf } = await orgWithUsers();
    const workspaceId = await createWorkspace(path, headersOf(admin));
    const projectIds = [await createProject(path, headersOf(admin), workspaceId), await createProject(path, headersOf(admin), workspaceId)];
    const invited = await createTestUser(`invited-${crypto.randomUUID().slice(0, 8)}@example.com`);
    const cookie = await createTestSession(invited);
    const invitationIds = await Promise.all(projectIds.map((projectId) => inviteToProject(org, projectId, invited, admin.id)));

    const results = await Promise.all(invitationIds.map((id) => accept(id, cookie)));

    for (const { response } of results) expect(response.status).toBe(200);
    expect(await workspacesHeldBy(invited.id)).toHaveLength(1);
  });

  it("moves the project memberships filed under a deleted workspace to the holder's next one", async () => {
    const { admin, path, headersOf } = await orgWithUsers();
    const workspaceId = await createWorkspace(path, headersOf(admin));
    const nextWorkspaceId = await createWorkspace(path, headersOf(admin));
    const projectId = await createProject(path, headersOf(admin), workspaceId);
    const [filed] = await projectMembershipsOf(admin.id, projectId);

    const { response } = await call(deleteWorkspaces, { path, body: { ids: [workspaceId] }, headers: headersOf(admin) });

    expect(response.status).toBe(200);
    const memberships = await projectMembershipsOf(admin.id, projectId);
    expect(memberships).toHaveLength(1);
    const { role, displayOrder, archived, muted, createdAt, createdBy } = filed;
    expect(memberships[0]).toMatchObject({
      role,
      displayOrder,
      archived,
      muted,
      createdAt,
      createdBy,
      workspaceId: nextWorkspaceId,
      updatedBy: admin.id,
    });
  });

  it("refuses to delete a person's last workspace in the organization, also within a batch", async () => {
    const { admin, path, headersOf } = await orgWithUsers();
    const onlyId = await createWorkspace(path, headersOf(admin));

    const alone = await call(deleteWorkspaces, { path, body: { ids: [onlyId] }, headers: headersOf(admin) });
    expect(alone.response.status).toBe(200);
    expect(alone.data).toMatchObject({ rejectedIds: [onlyId] });
    expect(await workspacesHeldBy(admin.id)).toHaveLength(1);

    const secondId = await createWorkspace(path, headersOf(admin));
    const projectId = await createProject(path, headersOf(admin), secondId);
    const batch = await call(deleteWorkspaces, { path, body: { ids: [onlyId, secondId] }, headers: headersOf(admin) });

    expect(batch.data).toMatchObject({ rejectedIds: [onlyId] });
    const [kept] = await workspacesHeldBy(admin.id);
    expect(kept.id).toBe(onlyId);
    expect((await projectMembershipsOf(admin.id, projectId))[0].workspaceId).toBe(onlyId);
  });

  it('refuses to file a project under a workspace for an organization member who is no project member', async () => {
    const { admin, member, path, headersOf } = await orgWithUsers();
    const projectId = await createProject(path, headersOf(admin), await createWorkspace(path, headersOf(admin)));
    const memberWorkspaceId = await createWorkspace(path, headersOf(member));

    const { response } = await call(assignProjectWorkspace, {
      path: { ...path, id: projectId },
      query: { workspaceId: memberWorkspaceId },
      headers: headersOf(member),
    });

    expect(response.status).toBe(404);
    expect(await projectMembershipsOf(member.id, projectId)).toHaveLength(0);
  });

  it('keeps a project guest a guest when they file the project under their workspace', async () => {
    const { org, admin, member, path, headersOf } = await orgWithUsers();
    const projectId = await createProject(path, headersOf(admin), await createWorkspace(path, headersOf(admin)));
    await adminDb.insert(membershipsTable).values({
      tenantId: org.tenantId,
      userId: member.id,
      channelType: 'project',
      channelId: projectId,
      organizationId: org.id,
      projectId,
      role: 'guest',
      displayOrder: 1000,
      createdBy: admin.id,
    });
    const memberWorkspaceId = await createWorkspace(path, headersOf(member));

    const { response } = await call(assignProjectWorkspace, {
      path: { ...path, id: projectId },
      query: { workspaceId: memberWorkspaceId },
      headers: headersOf(member),
    });

    expect(response.status).toBe(200);
    const memberships = await projectMembershipsOf(member.id, projectId);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ role: 'guest', workspaceId: memberWorkspaceId });
  });
});
