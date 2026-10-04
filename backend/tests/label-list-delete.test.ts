import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createLabels, createProjects, createTasks, createWorkspaces, deleteLabels, getLabels, getProject, getWorkspace } from 'sdk';
import { afterEach, describe, expect, it } from 'vitest';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { adminRole, defaultHeaders } from './fixtures';
import { adminDb, createTestOrganization } from './helpers';
import { bearerHeaders, serviceAccountWithKey } from './oauth-helpers';
import { clearSecurityTestData, createOrgUser } from './security/helpers';
import { createAppClient } from './test-client';
import { setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

type LabelRow = { id: string; name: string; mode: string; usedCount: number };

describe('Label lists, primary label deletes and API key reads of their channels', async () => {
  const call = await createAppClient();

  afterEach(async () => await clearSecurityTestData());

  /** An organization whose admin owns one project, created through the API so it has its primary labels. */
  async function orgWithProject() {
    const org = await createTestOrganization();
    const user = await createOrgUser(call, org.tenantId, org.id, `admin-${nanoid(8)}`, adminRole);
    const path = { tenantId: org.tenantId, organizationId: org.id };
    const headers = { ...defaultHeaders, Cookie: user.sessionCookie };
    const firstId = (result: { data?: unknown }) => String((result.data as { data: { id: string }[] } | undefined)?.data[0].id);
    const workspaceId = firstId(await call(createWorkspaces, { path, body: [{ id: `temp-${nanoid()}`, name: 'Home' }], headers }));
    const projects = await call(createProjects, {
      path,
      query: { workspaceId },
      body: [{ id: `temp-${nanoid()}`, name: 'Roadmap', slug: `roadmap-${crypto.randomUUID().slice(0, 8)}`, publicAt: null }],
      headers,
    });
    return { org, user, path, headers, workspaceId, projectId: firstId(projects) };
  }

  const listLabels = async (ctx: Awaited<ReturnType<typeof orgWithProject>>, query: Record<string, string> = {}) => {
    const result = await call(getLabels, { path: ctx.path, query: { projectId: ctx.projectId, ...query }, headers: ctx.headers });
    const data = result.data as { items: LabelRow[]; total: number } | undefined;
    return { status: result.response.status, items: data?.items ?? [], total: data?.total };
  };

  it('lists a project’s labels by name, and narrows by search and by mode', async () => {
    const ctx = await orgWithProject();
    const primaries = await listLabels(ctx);
    expect(primaries.status).toBe(200);
    expect(primaries.items.length).toBeGreaterThan(1);
    expect(primaries.total).toBe(primaries.items.length);
    expect(primaries.items.every((label) => label.mode === 'primary')).toBe(true);
    expect(primaries.items.map((label) => label.name)).toEqual([...primaries.items.map((label) => label.name)].sort((a, b) => a.localeCompare(b)));

    const created = await call(createLabels, {
      path: ctx.path,
      body: [{ id: crypto.randomUUID(), name: 'frontend-zebra', color: null, projectId: ctx.projectId, stx: mockStxBase() }],
      headers: ctx.headers,
    });
    expect(created.response.status).toBe(201);

    const searched = await listLabels(ctx, { q: 'zebra' });
    expect(searched.items.map((label) => label.name)).toEqual(['frontend-zebra']);
    expect(searched.total).toBe(1);

    const secondary = await listLabels(ctx, { modes: 'secondary' });
    expect(secondary.items.map((label) => label.name)).toEqual(['frontend-zebra']);
    expect((await listLabels(ctx, { modes: 'primary' })).total).toBe(primaries.items.length);
  });

  it('deletes a primary label while another remains, moves its tasks to the default, and keeps the last one', async () => {
    const ctx = await orgWithProject();
    const { items: primaries } = await listLabels(ctx, { sort: 'name' });
    const [first, ...rest] = primaries;

    const taskId = crypto.randomUUID();
    const task = await call(createTasks, {
      path: ctx.path,
      body: [
        {
          id: taskId,
          name: 'Tagged task',
          description: null,
          projectId: ctx.projectId,
          status: TaskStatus.Unstarted,
          primaryLabelId: first.id,
          stx: mockStxBase(),
        },
      ],
      headers: ctx.headers,
    });
    expect(task.response.status).toBe(201);

    const removed = await call(deleteLabels, { path: ctx.path, body: { ids: [first.id] }, headers: ctx.headers });
    expect(removed.response.status).toBe(200);
    expect((removed.data as { rejectedIds: string[] }).rejectedIds).toEqual([]);

    const [row] = await adminDb.select().from(tasksTable).where(eq(tasksTable.id, taskId));
    expect(rest.map((label) => label.id)).toContain(row.primaryLabelId);

    // The batch would leave the project without a primary label, so every id in it is refused.
    const all = await call(deleteLabels, { path: ctx.path, body: { ids: rest.map((label) => label.id) }, headers: ctx.headers });
    expect((all.data as { rejectedIds: string[] }).rejectedIds.sort()).toEqual(rest.map((label) => label.id).sort());
    expect((await listLabels(ctx, { modes: 'primary' })).total).toBe(rest.length);
  });

  it('lets an API key read a project and a workspace of its organization', async () => {
    const ctx = await orgWithProject();
    const key = await serviceAccountWithKey(ctx.org, ctx.user.sessionCookie);
    const headers = bearerHeaders(key.clientSecret);

    const project = await call(getProject, { path: { ...ctx.path, id: ctx.projectId }, headers });
    const workspace = await call(getWorkspace, { path: { ...ctx.path, id: ctx.workspaceId }, headers });

    expect({ project: project.response.status, workspace: workspace.response.status }).toEqual({ project: 200, workspace: 200 });
    expect(project.data).toMatchObject({ id: ctx.projectId, name: 'Roadmap' });
  });
});
