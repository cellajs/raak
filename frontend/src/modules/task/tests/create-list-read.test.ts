import { hydrate } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '~/modules/task/types';
import { callHook, queryClient, resetMutationHooks } from '~/query/tests/mutation-hooks-kit';

type Answer = { data: unknown[]; rejectedIds: string[] };
type Page = { items: unknown[]; total: number };
const { createTasks, deleteTasks, getTasks } = vi.hoisted(() => ({
  createTasks: vi.fn(async (_req: unknown): Promise<Answer> => ({ data: [], rejectedIds: [] })),
  deleteTasks: vi.fn(async (_req: unknown): Promise<Answer> => ({ data: [], rejectedIds: [] })),
  getTasks: vi.fn(async (_req: unknown): Promise<Page> => ({ items: [], total: 0 })),
}));

vi.mock('sdk', async (importOriginal) => ({ ...(await importOriginal<typeof import('sdk')>()), createTasks, deleteTasks, getTasks }));
vi.mock('~/modules/task/helpers/task-glow', () => ({ triggerTaskGlow: vi.fn() }));

const { ApiError } = await import('~/lib/api');
const { tasksCanonicalOptions, useTaskCreateMutation } = await import('~/modules/task/query');
const { initMutationDefaults } = await import('~/query/mutation-registry');

const ctx = { tenantId: 'ten-1', organizationId: 'org-1' };
const projectId = 'proj-1';
const homeKey = tasksCanonicalOptions({ ...ctx, projectId }).queryKey;

/** Only the fields the list and the mutation callbacks read. */
const task = (id: string) =>
  ({ id, entityType: 'task', name: id, projectId, status: 5, labels: [], assignedTo: [], deletedAt: null, ...ctx }) as unknown as Task;
const createInput = (id: string) => ({
  id,
  name: id,
  description: null,
  status: 5 as const,
  displayOrder: 10,
  projectId,
  labels: [],
  assignedTo: [],
  fullLabels: [],
  fullAssignedTo: [],
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const listed = () => queryClient.getQueryData<{ items: Task[] }>(homeKey)?.items ?? [];
const listedIds = () => listed().map(({ id }) => id);
const readList = () => queryClient.refetchQueries({ queryKey: homeKey });

/** A board with one stored task, read once, and a create of `t-new` sent but not yet answered. */
const boardWithCreateOut = async () => {
  getTasks.mockResolvedValue({ items: [task('t-old')], total: 1 });
  await queryClient.fetchQuery(tasksCanonicalOptions({ ...ctx, projectId }));
  const answer = deferred<Answer>();
  createTasks.mockReturnValueOnce(answer.promise);
  const created = callHook(() => useTaskCreateMutation(ctx.tenantId, ctx.organizationId)).mutateAsync(createInput('t-new'));
  await vi.waitFor(() => expect(createTasks).toHaveBeenCalledTimes(1));
  return { answer, created };
};

afterEach(resetMutationHooks);

describe('a task list read that races a create', () => {
  it('keeps the optimistic row when the read answers while the create is out', async () => {
    const { answer, created } = await boardWithCreateOut();
    expect(listedIds()).toEqual(['t-new', 't-old']);

    await readList();
    expect(listedIds()).toEqual(['t-new', 't-old']);

    answer.resolve({ data: [task('t-new')], rejectedIds: [] });
    await created;
    expect(listedIds()).toEqual(['t-new', 't-old']);
    expect(listed()[0]).not.toHaveProperty('_optimistic');
  });

  it('keeps the stored row when the read started before the create answered and ends after it', async () => {
    const { answer, created } = await boardWithCreateOut();
    const page = deferred<Page>();
    getTasks.mockReturnValueOnce(page.promise);
    const read = readList();

    answer.resolve({ data: [task('t-new')], rejectedIds: [] });
    await created;
    page.resolve({ items: [task('t-old')], total: 1 });
    await read;

    expect(listedIds()).toEqual(['t-new', 't-old']);
    expect(listed()[0]).not.toHaveProperty('_optimistic');
  });

  it('carries nothing for a create the server refused', async () => {
    const { answer, created } = await boardWithCreateOut();
    const page = deferred<Page>();
    getTasks.mockReturnValueOnce(page.promise);
    const read = readList();

    answer.reject(new ApiError({ status: 400, type: 'invalid_request', severity: 'warn' }));
    await expect(created).rejects.toThrow();
    page.resolve({ items: [task('t-old')], total: 1 });
    await read;

    expect(listedIds()).toEqual(['t-old']);
  });

  it('carries nothing for a row a delete is out for', async () => {
    const { answer, created } = await boardWithCreateOut();
    // A delete queued behind the create, as one restored from the offline queue holds it; its request stays out.
    initMutationDefaults(queryClient);
    deleteTasks.mockReturnValue(new Promise(() => {}));
    hydrate(queryClient, {
      queries: [],
      mutations: [
        {
          mutationKey: ['task', 'delete'],
          scope: { id: 'task' },
          state: {
            context: undefined,
            data: undefined,
            error: null,
            failureCount: 0,
            failureReason: null,
            isPaused: true,
            status: 'pending',
            submittedAt: Date.now(),
            variables: { ...ctx, rows: [task('t-new')] },
          },
        },
      ],
    });
    const page = deferred<Page>();
    getTasks.mockReturnValueOnce(page.promise);
    const read = readList();

    answer.resolve({ data: [task('t-new')], rejectedIds: [] });
    await created;
    page.resolve({ items: [task('t-old')], total: 1 });
    await read;

    expect(listedIds()).toEqual(['t-old']);
  });

  it('trusts a read that started after the create answered (positive control)', async () => {
    const { answer, created } = await boardWithCreateOut();
    answer.resolve({ data: [task('t-new')], rejectedIds: [] });
    await created;
    await new Promise((resolve) => setTimeout(resolve, 5));

    // The server lists it no more, as after someone else deleted it.
    await readList();
    expect(listedIds()).toEqual(['t-old']);
  });
});
