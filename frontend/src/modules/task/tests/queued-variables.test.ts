import { hydrate } from '@tanstack/react-query';
import type { Label } from 'sdk';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '~/modules/task/types';
import { callHook, mutationsOf, queryClient, resetMutationHooks } from '~/query/tests/mutation-hooks-kit';

type Req = { path: Record<string, string | undefined>; body: unknown };
type Answer = { data: unknown[]; rejectedIds: string[] };
const { createTasks, deleteTasks, createLabels, deleteLabels } = vi.hoisted(() => ({
  createTasks: vi.fn(async (_req: Req): Promise<Answer> => ({ data: [], rejectedIds: [] })),
  deleteTasks: vi.fn(async (_req: Req): Promise<Answer> => ({ data: [], rejectedIds: [] })),
  createLabels: vi.fn(async (_req: Req): Promise<Answer> => ({ data: [], rejectedIds: [] })),
  deleteLabels: vi.fn(async (_req: Req): Promise<Answer> => ({ data: [], rejectedIds: [] })),
}));

vi.mock('sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('sdk')>()),
  createTasks,
  deleteTasks,
  createLabels,
  deleteLabels,
}));

const { tasksCanonicalOptions, useTaskDeleteMutation } = await import('~/modules/task/query');
const { labelsCanonicalOptions, useLabelDeleteMutation } = await import('~/modules/label/query');
const { initMutationDefaults } = await import('~/query/mutation-registry');
const { upgradePersistedMutation } = await import('~/query/offline/mutation-variables');

const ctx = { tenantId: 'ten-1', organizationId: 'org-1' };
const projectId = 'proj-1';
const stx = { mutationId: 'mut-old', sourceId: 'tab', fieldTimestamps: {} };

/** Only the fields the mutation callbacks read. */
const task = (id: string) => ({ id, entityType: 'task', name: id, projectId, labels: [], assignedTo: [], ...ctx }) as unknown as Task;
const label = (id: string) => ({ id, entityType: 'label', name: id, projectId, ...ctx }) as unknown as Label;

/** A mutation as a bundle without variables versions left it in the store: paused, no version stamp. */
const storedByOlderBundle = (mutationKey: string[], variables: Record<string, unknown>) => ({
  mutationKey,
  scope: { id: mutationKey[0] },
  meta: { suppressGlobalErrorToast: true },
  state: {
    context: undefined,
    data: undefined,
    error: null,
    failureCount: 1,
    failureReason: null,
    isPaused: true,
    status: 'pending' as const,
    submittedAt: 100,
    variables,
  },
});

/** Restores one stored mutation as the app does at startup and replays it. */
const replay = async (stored: ReturnType<typeof storedByOlderBundle>) => {
  const upgraded = upgradePersistedMutation(stored);
  initMutationDefaults(queryClient);
  hydrate(queryClient, { queries: [], mutations: upgraded ? [upgraded] : [] });
  await queryClient.resumePausedMutations();
  const [entityType, operation] = stored.mutationKey as [string, 'create' | 'delete'];
  await vi.waitFor(() => expect(mutationsOf(entityType, operation).every(({ state }) => state.status === 'success')).toBe(true));
};

afterEach(resetMutationHooks);

describe('a mutation an older bundle queued', () => {
  it('replays a task create that held its row at the top level', async () => {
    createTasks.mockImplementation(async () => ({ data: [task('t-1')], rejectedIds: [] }));
    const row = { id: 't-1', name: 't-1', description: null, status: 1, projectId, fullLabels: [], fullAssignedTo: [] };
    await replay(storedByOlderBundle(['task', 'create'], { ...ctx, ...row, stx }));

    expect(createTasks).toHaveBeenCalledTimes(1);
    expect(createTasks.mock.lastCall?.[0]).toMatchObject({
      path: ctx,
      body: [{ id: 't-1', name: 't-1', projectId, stx: { mutationId: 'mut-old' } }],
    });
    const [sent] = createTasks.mock.calls[0][0].body as Record<string, unknown>[];
    for (const key of ['fullLabels', 'fullAssignedTo', 'tenantId', 'organizationId']) expect(sent).not.toHaveProperty(key);
  });

  it('replays a task delete that held its rows as tasksToDelete', async () => {
    await replay(storedByOlderBundle(['task', 'delete'], { ...ctx, tasksToDelete: [task('t-1'), task('t-2')], stx }));

    expect(deleteTasks).toHaveBeenCalledTimes(1);
    expect(deleteTasks.mock.lastCall?.[0]).toMatchObject({ path: ctx, body: { ids: ['t-1', 't-2'], stx: { mutationId: 'mut-old' } } });
  });

  it('replays a label create that held its one row under data', async () => {
    createLabels.mockImplementation(async () => ({ data: [label('l-1')], rejectedIds: [] }));
    await replay(storedByOlderBundle(['label', 'create'], { ...ctx, data: { id: 'l-1', name: 'l-1', projectId, color: null }, stx }));

    expect(createLabels).toHaveBeenCalledTimes(1);
    expect(createLabels.mock.lastCall?.[0]).toMatchObject({ path: ctx, body: [{ id: 'l-1', name: 'l-1', stx: { mutationId: 'mut-old' } }] });
  });

  it('replays a label delete that held its rows as labels', async () => {
    await replay(storedByOlderBundle(['label', 'delete'], { ...ctx, labels: [label('l-1')], stx }));

    expect(deleteLabels).toHaveBeenCalledTimes(1);
    expect(deleteLabels.mock.lastCall?.[0]).toMatchObject({ path: ctx, body: { ids: ['l-1'], stx: { mutationId: 'mut-old' } } });
  });
});

describe('a delete the server refuses', () => {
  it('marks the task list to be read again: the refused row left the cache when the delete was issued', async () => {
    const homeKey = tasksCanonicalOptions({ ...ctx, projectId }).queryKey;
    queryClient.setQueryData(homeKey, { items: [task('t-1'), task('t-2')], total: 2 });
    deleteTasks.mockImplementation(async () => ({ data: [], rejectedIds: ['t-1'] }));

    await callHook(() => useTaskDeleteMutation(ctx.tenantId, ctx.organizationId)).mutateAsync([task('t-1')]);

    expect(deleteTasks.mock.lastCall?.[0].body).toMatchObject({ ids: ['t-1'] });
    expect(queryClient.getQueryState(homeKey)?.isInvalidated).toBe(true);
  });

  it('marks the label list to be read again', async () => {
    const homeKey = labelsCanonicalOptions({ ...ctx, projectId }).queryKey;
    queryClient.setQueryData(homeKey, { items: [label('l-1')], total: 1 });
    deleteLabels.mockImplementation(async () => ({ data: [], rejectedIds: ['l-1'] }));

    await callHook(() => useLabelDeleteMutation(ctx.tenantId, ctx.organizationId)).mutateAsync([label('l-1')]);

    expect(queryClient.getQueryState(homeKey)?.isInvalidated).toBe(true);
  });

  it('leaves the list as it is when the server deletes every row (positive control)', async () => {
    const homeKey = tasksCanonicalOptions({ ...ctx, projectId }).queryKey;
    queryClient.setQueryData(homeKey, { items: [task('t-1'), task('t-2')], total: 2 });

    await callHook(() => useTaskDeleteMutation(ctx.tenantId, ctx.organizationId)).mutateAsync([task('t-1')]);

    expect(queryClient.getQueryState(homeKey)?.isInvalidated).toBe(false);
  });
});
