import { createProjects, createWorkspaces, getProjects } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterEach, describe, expect, it } from 'vitest';
import { mockPastIsoDate } from '#/mocks';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { adminRole, defaultHeaders, memberRole } from '../fixtures';
import { adminDb, createTestOrganization } from '../helpers';
import { createAppClient } from '../test-client';
import { clearSecurityTestData, createOrgUser } from './helpers';

describe("Another user's project list", async () => {
  const call = await createAppClient();

  afterEach(async () => await clearSecurityTestData());

  const unique = () => crypto.randomUUID().slice(0, 8);
  const headersOf = (user: { sessionCookie: string }) => ({ ...defaultHeaders, Cookie: user.sessionCookie });

  /** A listed user with one project in an organization the viewer shares and one in an organization the viewer is not in. */
  async function listedUserInTwoOrganizations() {
    const shared = await createTestOrganization();
    const other = await createTestOrganization();

    const listed = await createOrgUser(call, shared.tenantId, shared.id, `listed-${unique()}`, adminRole);
    await adminDb.insert(membershipsTable).values({
      id: generateId(),
      userId: listed.id,
      channelId: other.id,
      organizationId: other.id,
      tenantId: other.tenantId,
      channelType: 'organization',
      role: adminRole,
      displayOrder: 2,
      createdAt: mockPastIsoDate(),
      createdBy: listed.id,
    });

    for (const [organization, name] of [
      [shared, 'in-shared-organization'],
      [other, 'in-other-organization'],
    ] as const) {
      const path = { tenantId: organization.tenantId, organizationId: organization.id };
      const headers = headersOf(listed);
      const workspaces = await call(createWorkspaces, { path, body: [{ id: `temp-${crypto.randomUUID()}`, name: 'Home' }], headers });
      const workspaceId = (workspaces.data as { data: { id: string }[] }).data[0].id;
      const body = [{ id: `temp-${crypto.randomUUID()}`, name, slug: `${name}-${unique()}`, publicAt: null }];
      const result = await call(createProjects, { path, query: { workspaceId }, body, headers });
      expect(result.response.status).toBe(201);
    }

    const viewer = await createOrgUser(call, shared.tenantId, shared.id, `viewer-${unique()}`, memberRole);
    return { shared, other, listed, viewer };
  }

  const namesOf = (result: { data?: unknown }) =>
    ((result.data as { items: { name: string }[] } | undefined)?.items ?? []).map(({ name }) => name).sort();

  it('lists only the projects in organizations the caller shares with that user', async () => {
    const { listed, viewer } = await listedUserInTwoOrganizations();

    const result = await call(getProjects, { query: { relatableUserId: listed.id }, headers: headersOf(viewer) });

    expect(result.response.status).toBe(200);
    expect(namesOf(result)).toEqual(['in-shared-organization']);
  });

  it("never returns the listed user's membership as the caller's", async () => {
    const { listed, viewer } = await listedUserInTwoOrganizations();

    const result = await call(getProjects, { query: { relatableUserId: listed.id, include: 'membership' }, headers: headersOf(viewer) });

    const items = (result.data as { items: { included?: { membership?: unknown } }[] } | undefined)?.items ?? [];
    expect(items).toHaveLength(1);
    expect(items[0].included?.membership).toBeUndefined();
  });

  it("refuses filters on the listed user's own membership", async () => {
    const { listed, viewer } = await listedUserInTwoOrganizations();

    for (const query of [{ role: adminRole }, { excludeArchived: 'true' as const }]) {
      const result = await call(getProjects, { query: { relatableUserId: listed.id, ...query }, headers: headersOf(viewer) });
      expect(result.response.status).toBe(403);
    }
  });

  it('still lists all of the caller’s own projects', async () => {
    const { listed } = await listedUserInTwoOrganizations();

    const result = await call(getProjects, { query: {}, headers: headersOf(listed) });

    expect(namesOf(result)).toEqual(['in-other-organization', 'in-shared-organization']);
  });
});
