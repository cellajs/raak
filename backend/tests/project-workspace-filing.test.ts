import { and, eq } from 'drizzle-orm';
import { assignProjectWorkspace, createProjects, createWorkspaces, deleteWorkspaces } from 'sdk';
import { afterEach, describe, expect, it } from 'vitest';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { adminRole, defaultHeaders, memberRole } from './fixtures';
import { adminDb, createTestOrganization } from './helpers';
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

  it('keeps the project memberships filed under a deleted workspace, unfiled', async () => {
    const { admin, path, headersOf } = await orgWithUsers();
    const workspaceId = await createWorkspace(path, headersOf(admin));
    const projectId = await createProject(path, headersOf(admin), workspaceId);

    const { response } = await call(deleteWorkspaces, { path, body: { ids: [workspaceId] }, headers: headersOf(admin) });

    expect(response.status).toBe(200);
    const memberships = await projectMembershipsOf(admin.id, projectId);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ role: 'admin', workspaceId: null });
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
