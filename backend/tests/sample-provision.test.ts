import '#/modules'; // composition root: the label module gives each new project its task types

import { and, asc, eq, inArray } from 'drizzle-orm';
import { hierarchy } from 'shared';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrgContext } from '#/core/context';
import { baseDb } from '#/db/db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { findMembershipsByUserIds } from '#/modules/memberships/memberships-queries';
import { withOrganizationDefaults } from '#/modules/organization/helpers/select';
import type { OrganizationModel } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';
import { provisionSample } from '#/modules/sample/operations/provision-sample';
import { foldedSampleProjectIds, sampleContent, samplePersonIds } from '#/modules/sample/sample-content';
import { tasksTable } from '#/modules/task/task-db';
import { loadTenant } from '#/modules/tenants/load-tenant';
import { emailsTable } from '#/modules/user/emails-db';
import { usersTable } from '#/modules/user/user-db';
import { adminRole, memberRole } from './fixtures';
import { adminDb, createOrganizationAdminUser, createTestOrganization } from './helpers';
import { clearSecurityTestData } from './security/helpers';

/** The context a seed or a job hands `provisionSample`: the user acting in the organization, as the guards set it for a request. */
async function orgContext(organization: OrganizationModel, userId: string): Promise<OrgContext> {
  const tenant = await loadTenant(organization.tenantId);
  if (!tenant) throw new Error(`No tenant ${organization.tenantId}`);
  const bindings = await findMembershipsByUserIds({ var: { db: baseDb } }, { userIds: [userId] });
  const membership = bindings.find((binding) => binding.organizationId === organization.id && binding.channelType === 'organization') ?? null;
  return {
    var: {
      actor: { kind: 'user', id: userId, bindings, scopes: null },
      isSystemAdmin: false,
      db: baseDb,
      tenantId: organization.tenantId,
      tenant,
      organizationId: organization.id,
      organization: { ...withOrganizationDefaults(organization), membership },
    },
  };
}

async function organizationWithMembers() {
  const organization = await createTestOrganization();
  const label = crypto.randomUUID().slice(0, 8);
  const admin = await createOrganizationAdminUser(`admin-${label}@sample-test.com`, organization.id, adminRole, organization.tenantId);
  const member = await createOrganizationAdminUser(`member-${label}@sample-test.com`, organization.id, memberRole, organization.tenantId);
  return { organization, admin, member };
}

const provisionAs = async (organization: OrganizationModel, userId: string) => provisionSample(await orgContext(organization, userId), { userId });

/** The user's project roles by project id: a fresh user holds projects in this organization only. */
const projectRolesOf = async (userId: string) => {
  const rows = await adminDb
    .select({ projectId: membershipsTable.channelId, role: membershipsTable.role })
    .from(membershipsTable)
    .where(and(eq(membershipsTable.userId, userId), eq(membershipsTable.channelType, 'project')));
  return Object.fromEntries(rows.map(({ projectId, role }) => [projectId, role]));
};

const eachAs = (projects: { id: string }[], role: string) => Object.fromEntries(projects.map(({ id }) => [id, role]));

const idsOf = (projects: { id: string }[]) => projects.map(({ id }) => id).sort();

const countIn = async (table: typeof projectsTable | typeof tasksTable, organizationId: string) =>
  (await adminDb.select({ id: table.id }).from(table).where(eq(table.organizationId, organizationId))).length;

const firstBlockText = (description: string | null) => JSON.parse(description ?? '[]')[0]?.content?.[0]?.text;

/** The showcase seed and the demo provision the sample without a request, and read its numbers and accounts. */
describe('Provisioning the sample', () => {
  afterEach(async () => await clearSecurityTestData());

  it('writes three projects with tasks #1 to #30 in dataset order, by four accounts no mail reaches', async () => {
    const { organization, admin } = await organizationWithMembers();

    const { projects, created } = await provisionAs(organization, admin.id);

    expect(created).toBe(true);
    expect(projects.map(({ name }) => name).sort()).toEqual(['Help center', 'Mobile app', 'Website']);
    expect(foldedSampleProjectIds(projects)).toEqual(projects.filter(({ name }) => name === 'Help center').map(({ id }) => id));
    // The avatar color comes from the id's last character, so every organization's sample looks like the about page's picture
    expect(Object.fromEntries(projects.map(({ name, id }) => [name, id.at(-1)]))).toEqual(
      Object.fromEntries(sampleContent.projects.map(({ name, color }) => [name, String(color)])),
    );

    const tasks = await adminDb.select().from(tasksTable).where(eq(tasksTable.organizationId, organization.id)).orderBy(asc(tasksTable.number));
    expect(tasks.map(({ number }) => number)).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
    expect(tasks.map(({ description }) => firstBlockText(description))).toEqual(sampleContent.tasks.map(({ name }) => name));

    expect(await adminDb.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.id, samplePersonIds))).toHaveLength(4);
    expect(await adminDb.select().from(emailsTable).where(inArray(emailsTable.userId, samplePersonIds))).toEqual([]);

    expect(await projectRolesOf(admin.id)).toEqual(eachAs(projects, hierarchy.getMostPrivilegedRole('project')));
    const filed = await adminDb
      .select({ workspaceId: membershipsTable.workspaceId })
      .from(membershipsTable)
      .where(and(eq(membershipsTable.userId, admin.id), eq(membershipsTable.channelType, 'project')));
    expect(filed).toEqual(projects.map(() => ({ workspaceId: expect.any(String) })));
  });

  it('adds a later caller to the same projects as a member', async () => {
    const { organization, admin, member } = await organizationWithMembers();
    const first = await provisionAs(organization, admin.id);

    const second = await provisionAs(organization, member.id);

    expect(second.created).toBe(false);
    expect(idsOf(second.projects)).toEqual(idsOf(first.projects));
    expect(await projectRolesOf(member.id)).toEqual(eachAs(first.projects, 'member'));
  });

  it('never makes a second sample, from calls at once or a repeated one', async () => {
    const { organization, admin, member } = await organizationWithMembers();

    const results = await Promise.all([provisionAs(organization, admin.id), provisionAs(organization, member.id)]);
    const again = await provisionAs(organization, admin.id);

    expect(results.filter(({ created }) => created)).toHaveLength(1);
    expect(again.created).toBe(false);
    expect(await countIn(projectsTable, organization.id)).toBe(sampleContent.projects.length);
    expect(await countIn(tasksTable, organization.id)).toBe(sampleContent.tasks.length);
    expect(Object.keys(await projectRolesOf(admin.id)).sort()).toEqual(idsOf(again.projects));
    expect(Object.keys(await projectRolesOf(member.id)).sort()).toEqual(idsOf(again.projects));
  });
});
