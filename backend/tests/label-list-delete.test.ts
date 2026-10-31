import { eq, inArray, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createLabels, createProjects, createTasks, createWorkspaces, deleteLabels, getLabels, getProject, getWorkspace } from 'sdk';
import { afterEach, describe, expect, it } from 'vitest';
import { labelsTable } from '#/modules/label/label-db';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase, mockStxFor } from '#/schemas/sync-transaction-mocks';
import { adminRole, defaultHeaders } from './fixtures';
import { adminDb, createTestOrganization } from './helpers';
import { bearerHeaders, serviceAccountWithKey } from './oauth-helpers';
import { clearSecurityTestData, createFactorOrgUser } from './security/helpers';
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
    const user = await createFactorOrgUser(call, org.tenantId, org.id, `admin-${nanoid(8)}`, adminRole);
    const path = { tenantId: org.tenantId, organizationId: org.id };
    const headers = { ...defaultHeaders, Cookie: user.sessionCookie };
    const firstId = (result: { data?: unknown }) => String((result.data as { data: { id: string }[] } | undefined)?.data[0].id);
    const workspaceId = firstId(await call(createWorkspaces, { path, body: [{ id: `temp-${nanoid()}`, name: 'Home' }], headers }));
    const projects = await call(createProjects, {
      path,
      query: { workspaceId },
      body: [{ id: `temp-${nanoid()}`, name: 'Roadmap', slug: `roadmap-${crypto.randomUUID().slice(0, 8)}`, public: false }],
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

  it('refuses a label created with a name that is empty as a slug', async () => {
    const ctx = await orgWithProject();
    const created = await call(createLabels, {
      path: ctx.path,
      body: [{ id: crypto.randomUUID(), name: '', color: null, projectId: ctx.projectId, stx: mockStxBase() }],
      headers: ctx.headers,
    });
    expect(created.response.status).toBe(400);
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

  it('does not reject a primary label another delete removes while this one waits for the project', async () => {
    const ctx = await orgWithProject();
    const [doubled, kept, ...extra] = (await listLabels(ctx, { modes: 'primary' })).items;
    const deletedAt = new Date().toISOString();
    if (extra.length > 0) {
      await adminDb
        .update(labelsTable)
        .set({ deletedAt, deletedBy: ctx.user.id })
        .where(
          inArray(
            labelsTable.id,
            extra.map(({ id }) => id),
          ),
        );
    }

    // The first delete holds the project and has removed the label, uncommitted, until the second one waits on it.
    const holderPid = Promise.withResolvers<number>();
    const secondWaiting = Promise.withResolvers<void>();
    const first = adminDb.transaction(async (tx) => {
      await tx.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, ctx.projectId)).for('no key update');
      await tx.update(labelsTable).set({ deletedAt, deletedBy: ctx.user.id }).where(eq(labelsTable.id, doubled.id));
      const { rows } = await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`);
      holderPid.resolve(rows[0].pid);
      await secondWaiting.promise;
    });
    const pid = await holderPid.promise;
    const second = call(deleteLabels, { path: ctx.path, body: { ids: [doubled.id] }, headers: ctx.headers });
    for (;;) {
      const { rows } = await adminDb.execute<{ waiting: number }>(
        sql`SELECT count(*)::int AS waiting FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))`,
      );
      if (rows[0].waiting > 0) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    secondWaiting.resolve();
    await first;

    const removed = await second;
    expect(removed.response.status).toBe(200);
    expect((removed.data as { rejectedIds: string[] }).rejectedIds).toEqual([]);
    expect((await listLabels(ctx, { modes: 'primary' })).items.map(({ id }) => id)).toEqual([kept.id]);
  });

  it('creates a label or a task only in a project of the request organization', async () => {
    const ctx = await orgWithProject();
    const other = await orgWithProject();

    const label = await call(createLabels, {
      path: ctx.path,
      body: [{ id: crypto.randomUUID(), name: 'misplaced', color: null, projectId: other.projectId, stx: mockStxFor() }],
      headers: ctx.headers,
    });
    const task = await call(createTasks, {
      path: ctx.path,
      body: [
        {
          id: crypto.randomUUID(),
          name: 'Misplaced',
          description: null,
          projectId: other.projectId,
          status: TaskStatus.Unstarted,
          stx: mockStxFor(),
        },
      ],
      headers: ctx.headers,
    });

    expect({ label: label.response.status, task: task.response.status }).toEqual({ label: 404, task: 404 });
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
