import { and, eq } from 'drizzle-orm';
import { createProjects, createWorkspaces } from 'sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { labelsTable } from '#/modules/label/label-db';
import { membershipsTable } from '#/modules/memberships/memberships-db';
import { projectsTable } from '#/modules/project/project-db';
import { adminRole, defaultHeaders } from './fixtures';
import { adminDb, createTestOrganization } from './helpers';
import { clearSecurityTestData, createOrgUser } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

/** Lets one test make the creator's membership insert fail, after the project rows and their labels are written. */
const failMemberships = vi.hoisted(() => ({ next: false }));
vi.mock('#/modules/memberships/operations/insert-memberships', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#/modules/memberships/operations/insert-memberships')>();
  return {
    ...actual,
    insertMemberships: (...args: Parameters<typeof actual.insertMemberships>) => {
      if (!failMemberships.next) return actual.insertMemberships(...args);
      failMemberships.next = false;
      throw new Error('membership insert failed');
    },
  };
});

describe('Creating workspaces and projects', async () => {
  const call = await createAppClient();

  afterEach(async () => await clearSecurityTestData());

  async function orgWithAdmin() {
    const org = await createTestOrganization();
    const user = await createOrgUser(call, org.tenantId, org.id, `creator-${crypto.randomUUID().slice(0, 8)}`, adminRole);
    const path = { tenantId: org.tenantId, organizationId: org.id };
    return { org, user, path, headers: { ...defaultHeaders, Cookie: user.sessionCookie } };
  }

  /** The batch response of both create routes, as far as these tests read it. */
  type Created = { data: { id: string; slug: string; included?: { membership?: unknown } }[] } | undefined;
  const created = (result: { data?: unknown }) => (result.data as Created)?.data ?? [];

  const newProject = (name: string) => ({
    id: `temp-${crypto.randomUUID()}`,
    name,
    slug: `${name}-${crypto.randomUUID().slice(0, 8)}`,
    publicAt: null,
  });

  it('gives every workspace of one request a slug of its own', async () => {
    const { path, headers } = await orgWithAdmin();
    const body = ['One', 'Two', 'Three'].map((name) => ({ id: `temp-${crypto.randomUUID()}`, name }));

    const result = await call(createWorkspaces, { path, body, headers });

    expect(result.response.status).toBe(201);
    expect(created(result)).toHaveLength(3);
    expect(new Set(created(result).map((workspace) => workspace.slug)).size).toBe(3);
  });

  it('creates a project with its primary labels and the creator as its admin', async () => {
    const { user, path, headers } = await orgWithAdmin();
    const workspaces = await call(createWorkspaces, { path, body: [{ id: `temp-${crypto.randomUUID()}`, name: 'Home' }], headers });
    const workspaceId = created(workspaces)[0].id;

    const result = await call(createProjects, { path, query: { workspaceId }, body: [newProject('alpha')], headers });

    expect(result.response.status).toBe(201);
    const [project] = created(result);
    expect(project.included?.membership).toMatchObject({ role: 'admin', workspaceId });

    const labels = await adminDb.select().from(labelsTable).where(eq(labelsTable.projectId, project.id));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every((label) => label.mode === 'primary' && label.createdBy === user.id)).toBe(true);
  });

  it('leaves no project and no labels behind when the membership insert fails', async () => {
    const { user, path, headers } = await orgWithAdmin();
    const workspaces = await call(createWorkspaces, { path, body: [{ id: `temp-${crypto.randomUUID()}`, name: 'Home' }], headers });
    const workspaceId = created(workspaces)[0].id;
    const item = newProject('beta');

    failMemberships.next = true;
    const { response } = await call(createProjects, { path, query: { workspaceId }, body: [item], headers });

    expect(response.status).toBe(500);
    expect(await adminDb.select().from(projectsTable).where(eq(projectsTable.slug, item.slug))).toHaveLength(0);
    expect(await adminDb.select().from(labelsTable).where(eq(labelsTable.organizationId, path.organizationId))).toHaveLength(0);
    const memberships = await adminDb
      .select()
      .from(membershipsTable)
      .where(and(eq(membershipsTable.userId, user.id), eq(membershipsTable.channelType, 'project')));
    expect(memberships).toHaveLength(0);
  });
});
