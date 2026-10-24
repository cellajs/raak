import { deleteOrganizations, getProjects, getWorkspaces, updateTenant } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { nanoid } from 'shared/utils/nanoid';
import { afterEach, describe, expect, it } from 'vitest';
import { baseDb as db } from '#/db/db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { workspacesTable } from '#/modules/workspace/workspace-db';
import { defaultHeaders } from '../fixtures';
import { createSystemAdminUser, createTestSession } from '../helpers';
import { createAppClient } from '../test-client';
import { setTestConfig } from '../test-utils';
import { clearSecurityTestData, createOrgUser, createTestTenant } from './helpers';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

afterEach(async () => await clearSecurityTestData());

// The user's own project and workspace lists join memberships directly, so they leave out an archived tenant themselves.
describe('Archived organizations in the project and workspace lists', async () => {
  const call = await createAppClient();

  it("must not list a deleted organization's projects and workspaces to their members, until a system admin restores it", async () => {
    const tenant = await createTestTenant(call, 'archived-channels');
    const member = await createOrgUser(call, tenant.tenantId, tenant.organization.id, 'archived-channels-member');
    const headers = { ...defaultHeaders, Cookie: member.sessionCookie };
    const base = { tenantId: tenant.tenantId, organizationId: tenant.organization.id, createdBy: tenant.user.id };
    const projectId = generateId();
    const workspaceId = generateId();
    await db.insert(projectsTable).values({ ...base, id: projectId, name: 'Archived project', slug: `archived-project-${nanoid(8)}` });
    await db.insert(workspacesTable).values({ ...base, id: workspaceId, name: 'Archived workspace', slug: `archived-workspace-${nanoid(8)}` });
    const membership = { ...base, userId: member.id, role: 'member' as const, displayOrder: 1 };
    await db.insert(membershipsTable).values([
      { ...membership, id: generateId(), channelType: 'project', channelId: projectId, projectId },
      { ...membership, id: generateId(), channelType: 'workspace', channelId: workspaceId, workspaceId },
    ]);

    const listed = async () => {
      const projects = (await call(getProjects, { headers })).data as { items: { id: string }[] };
      const workspaces = (await call(getWorkspaces, { headers })).data as { items: { id: string }[] };
      return [...projects.items, ...workspaces.items].map(({ id }) => id);
    };
    expect(await listed()).toEqual(expect.arrayContaining([projectId, workspaceId]));

    const deleted = await call(deleteOrganizations, {
      path: { tenantId: tenant.tenantId },
      body: { ids: [tenant.organization.id] },
      headers: { ...defaultHeaders, Cookie: tenant.sessionCookie },
    });
    expect(deleted.response.status).toBe(200);
    expect(await listed()).toEqual([]);

    const admin = await createSystemAdminUser(`archived-channels-sysadmin-${nanoid(6)}@security-test.com`);
    const restored = await call(updateTenant, {
      path: { tenantId: tenant.tenantId },
      body: { status: 'active' },
      headers: { ...defaultHeaders, Cookie: await createTestSession(admin) },
    });
    expect(restored.response.status).toBe(200);
    expect(await listed()).toEqual(expect.arrayContaining([projectId, workspaceId]));
  });
});
