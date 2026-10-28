import { eq } from 'drizzle-orm';
import { createProjects, createWorkspaces, updateProject, updateWorkspace } from 'sdk';
import { generateId } from 'shared/utils/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { projectsTable } from '#/modules/project/project-db';
import { workspacesTable } from '#/modules/workspace/workspace-db';
import { adminRole, defaultHeaders } from '../fixtures';
import { adminDb, createTestOrganization } from '../helpers';
import { createAppClient, type TestResult } from '../test-client';
import { setTestConfig } from '../test-utils';
import { clearSecurityTestData, createOrgUser } from './helpers';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

type Path = { tenantId: string; organizationId: string };

interface Row {
  route: string;
  /** The write, naming columns the caller may not set beside one they may; resolves to the id of the row it wrote. */
  send: () => Promise<{ result: TestResult; id: string }>;
  /** The status of a write that ran. */
  status: number;
  row: (id: string) => Promise<Record<string, unknown>>;
  /** The permitted field, as sent: proof that the write ran. */
  changed: Record<string, unknown>;
  /** The columns the caller may not set, with the values they must keep. */
  kept: () => Record<string, unknown>;
}

/**
 * The create items and the update picks are the whole barrier: the operations spread the body into the row, so a pick
 * gaining `tenantId`, `organizationId`, `createdBy` or `id` would move, misattribute or re-key a project or workspace.
 */
describe('Project and workspace columns outside the body', async () => {
  const call = await createAppClient();
  let path: Path;
  let foreign: Path & { userId: string };
  let admin: { id: string; sessionCookie: string };
  let workspaceId: string;
  let projectId: string;

  const headers = () => ({ ...defaultHeaders, Cookie: admin.sessionCookie });
  const tempId = () => `temp-${crypto.randomUUID()}`;
  const unique = () => crypto.randomUUID().slice(0, 8);
  const createdId = (result: TestResult) => (result.data as { data: { id: string }[] } | undefined)?.data[0]?.id ?? '';
  /** Org B's ids and its admin: values the foreign keys would take. */
  const planted = () => ({ tenantId: foreign.tenantId, organizationId: foreign.organizationId, createdBy: foreign.userId });

  const projectRow = async (id: string) => (await adminDb.select().from(projectsTable).where(eq(projectsTable.id, id)))[0];
  const workspaceRow = async (id: string) => (await adminDb.select().from(workspacesTable).where(eq(workspacesTable.id, id)))[0];
  const own = () => ({ tenantId: path.tenantId, organizationId: path.organizationId, createdBy: admin.id });

  beforeAll(async () => {
    const organization = await createTestOrganization();
    path = { tenantId: organization.tenantId, organizationId: organization.id };
    admin = await createOrgUser(call, path.tenantId, path.organizationId, 'channel-mass-admin', adminRole);
    const other = await createTestOrganization();
    const otherAdmin = await createOrgUser(call, other.tenantId, other.id, 'channel-mass-other', adminRole);
    foreign = { tenantId: other.tenantId, organizationId: other.id, userId: otherAdmin.id };

    workspaceId = createdId(await call(createWorkspaces, { path, body: [{ id: tempId(), name: 'Home' }], headers: headers() }));
    const body = [{ id: tempId(), name: 'Alpha', slug: `alpha-${unique()}`, public: false }];
    projectId = createdId(await call(createProjects, { path, query: { workspaceId }, body, headers: headers() }));
  });

  afterAll(async () => await clearSecurityTestData());

  const rows: Row[] = [
    {
      route: 'createProjects',
      status: 201,
      send: async () => {
        const body = [{ id: tempId(), name: 'Planted project', slug: `planted-${unique()}`, public: false, ...planted() }];
        const result = await call(createProjects, { path, query: { workspaceId }, body: body as never, headers: headers() });
        return { result, id: createdId(result) };
      },
      row: projectRow,
      changed: { name: 'Planted project' },
      kept: own,
    },
    {
      route: 'updateProject',
      status: 200,
      send: async () => {
        const body = { name: 'Renamed project', ...planted(), id: generateId() };
        return { result: await call(updateProject, { path: { ...path, id: projectId }, body: body as never, headers: headers() }), id: projectId };
      },
      row: projectRow,
      changed: { name: 'Renamed project' },
      kept: own,
    },
    {
      route: 'createWorkspaces',
      status: 201,
      send: async () => {
        const body = [{ id: tempId(), name: 'Planted workspace', ...planted() }];
        const result = await call(createWorkspaces, { path, body: body as never, headers: headers() });
        return { result, id: createdId(result) };
      },
      row: workspaceRow,
      changed: { name: 'Planted workspace' },
      kept: own,
    },
    {
      route: 'updateWorkspace',
      status: 200,
      send: async () => {
        const body = { name: 'Renamed workspace', ...planted(), id: generateId() };
        return {
          result: await call(updateWorkspace, { path: { ...path, id: workspaceId }, body: body as never, headers: headers() }),
          id: workspaceId,
        };
      },
      row: workspaceRow,
      changed: { name: 'Renamed workspace' },
      kept: own,
    },
  ];

  it.each(rows)('must not set the tenant, organization, creator or id via $route', async ({ send, status, row, changed, kept }) => {
    const { result, id } = await send();
    expect(result.response.status).toBe(status);
    expect(await row(id)).toMatchObject({ ...changed, ...kept() });
  });
});
