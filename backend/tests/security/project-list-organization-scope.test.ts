import { eq } from 'drizzle-orm';
import { createProjects, createWorkspaces, getProjects } from 'sdk';
import { afterEach, describe, expect, it } from 'vitest';
import { projectsTable } from '#/modules/project/project-db';
import { adminRole, defaultHeaders, memberRole } from '../fixtures';
import { adminDb, createTestOrganization } from '../helpers';
import { createAppClient } from '../test-client';
import { clearSecurityTestData, createOrgUser } from './helpers';

describe("An organization's project list (scope=organization)", async () => {
  const call = await createAppClient();

  afterEach(async () => await clearSecurityTestData());

  const unique = () => crypto.randomUUID().slice(0, 8);
  const headersOf = (user: { sessionCookie: string }) => ({ ...defaultHeaders, Cookie: user.sessionCookie });

  /** An organization whose owner made two projects, plus an admin and a member who hold no project membership. */
  async function organizationWithTwoProjects() {
    const organization = await createTestOrganization();
    const owner = await createOrgUser(call, organization.tenantId, organization.id, `owner-${unique()}`, adminRole);

    const path = { tenantId: organization.tenantId, organizationId: organization.id };
    const headers = headersOf(owner);
    const workspaces = await call(createWorkspaces, { path, body: [{ id: `temp-${crypto.randomUUID()}`, name: 'Home' }], headers });
    const workspaceId = (workspaces.data as { data: { id: string }[] }).data[0].id;
    // Created out of name order, so a list by name is told apart from one by creation
    const body = ['beta', 'alpha'].map((name) => ({ id: `temp-${crypto.randomUUID()}`, name, slug: `${name}-${unique()}`, publicAt: null }));
    const created = await call(createProjects, { path, query: { workspaceId }, body, headers });
    expect(created.response.status).toBe(201);
    const projects = (created.data as { data: { id: string; name: string }[] }).data;

    const admin = await createOrgUser(call, organization.tenantId, organization.id, `admin-${unique()}`, adminRole);
    const member = await createOrgUser(call, organization.tenantId, organization.id, `member-${unique()}`, memberRole);
    return { organization, owner, admin, member, projects, workspaceId };
  }

  type ListedProject = { name: string; included?: { membership?: unknown } };
  const itemsOf = (result: { data?: unknown }) => (result.data as { items: ListedProject[] } | undefined)?.items ?? [];
  const namesOf = (result: { data?: unknown }) => itemsOf(result).map(({ name }) => name);

  it('lists projects the caller is not a member of, by name', async () => {
    const { organization, admin, member } = await organizationWithTwoProjects();

    for (const caller of [admin, member]) {
      const own = await call(getProjects, { query: { organizationId: organization.id }, headers: headersOf(caller) });
      expect(namesOf(own)).toEqual([]);

      const query = { organizationId: organization.id, scope: 'organization' as const, include: 'membership' };
      const result = await call(getProjects, { query, headers: headersOf(caller) });
      expect(result.response.status).toBe(200);
      expect(namesOf(result)).toEqual(['alpha', 'beta']);
      expect((result.data as { total: number }).total).toBe(2);
      expect(itemsOf(result).every(({ included }) => included?.membership === undefined)).toBe(true);
    }
  });

  it("carries the caller's own membership on the projects they are a member of", async () => {
    const { organization, owner } = await organizationWithTwoProjects();

    const query = { organizationId: organization.id, scope: 'organization' as const, include: 'membership' };
    const result = await call(getProjects, { query, headers: headersOf(owner) });

    expect(namesOf(result)).toEqual(['alpha', 'beta']);
    expect(itemsOf(result).every(({ included }) => included?.membership !== undefined)).toBe(true);
  });

  it('shows an unpublished project to an organization admin, not to a plain member', async () => {
    const { organization, admin, member, projects } = await organizationWithTwoProjects();
    const draft = projects.find(({ name }) => name === 'beta');
    if (!draft) throw new Error('beta project missing');
    await adminDb.update(projectsTable).set({ publishedAt: null }).where(eq(projectsTable.id, draft.id));

    const query = { organizationId: organization.id, scope: 'organization' as const };
    expect(namesOf(await call(getProjects, { query, headers: headersOf(admin) }))).toEqual(['alpha', 'beta']);
    expect(namesOf(await call(getProjects, { query, headers: headersOf(member) }))).toEqual(['alpha']);
  });

  it('lists nothing of an organization the caller is not a member of', async () => {
    const { organization } = await organizationWithTwoProjects();
    const elsewhere = await createTestOrganization();
    const outsider = await createOrgUser(call, elsewhere.tenantId, elsewhere.id, `outsider-${unique()}`, adminRole);

    const query = { organizationId: organization.id, scope: 'organization' as const };
    const result = await call(getProjects, { query, headers: headersOf(outsider) });

    expect(result.response.status).toBe(200);
    expect(namesOf(result)).toEqual([]);
    expect((result.data as { total: number }).total).toBe(0);
  });

  it('refuses the scope without an organization, with a membership filter or for another user', async () => {
    const { organization, owner, member, workspaceId } = await organizationWithTwoProjects();
    const scoped = { organizationId: organization.id, scope: 'organization' as const };

    const refused = [
      { scope: 'organization' as const },
      { ...scoped, role: adminRole },
      { ...scoped, excludeArchived: 'true' as const },
      { ...scoped, workspaceId },
      { ...scoped, relatableUserId: owner.id },
    ];
    for (const query of refused) {
      const result = await call(getProjects, { query, headers: headersOf(member) });
      expect(result.response.status).toBe(400);
    }
  });
});
