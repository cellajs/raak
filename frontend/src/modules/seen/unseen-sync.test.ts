import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
vi.stubGlobal('navigator', { onLine: true });

const { queryClient } = await import('~/query/query-client');
const { seenKeys } = await import('./helpers');
const { useSeenStore } = await import('./seen-store');
const { applyHardDeleteUnseen, ingestSyncedRows, noteUnseenReconciled } = await import('./unseen-sync');

// Our config tracks 'task', which homes at `project` (not org, as in base cella): the deepest
// non-null ancestor id on the row IS the badge channel, so rows carry projectId AND organizationId
// and CHANNEL is a project id. `resolveDeepestAncestorId` walks task → ['project', 'organization'].
const CHANNEL = 'project-1';
const ORG = 'org-1';
const now = () => new Date().toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

const row = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  projectId: CHANNEL,
  organizationId: ORG,
  createdAt: now(),
  deletedAt: null,
  ...overrides,
});

const counts = () => (queryClient.getQueryData(seenKeys.unseenCounts) as Record<string, Record<string, number>>) ?? {};

/** Deltas batch via idle callback (setTimeout fallback outside the browser) — flush it. */
const settle = () => vi.advanceTimersByTimeAsync(5_100);

describe('unseen count deltas from synced rows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    queryClient.setQueryData(seenKeys.unseenCounts, { [CHANNEL]: { task: 5 } });
    useSeenStore.getState().reset();
    noteUnseenReconciled();
  });

  afterEach(() => {
    queryClient.removeQueries({ queryKey: seenKeys.unseenCounts });
    vi.useRealTimers();
  });

  it('counts a new unseen row once, even when it reappears in later ranges (created, then updated)', async () => {
    vi.advanceTimersByTime(10); // created after the reconcile anchor
    ingestSyncedRows('task', CHANNEL, [row('a1')]);
    ingestSyncedRows('task', CHANNEL, [row('a1')]); // same row, next range
    await settle();

    expect(counts()[CHANNEL].task).toBe(6);
  });

  it('does not count rows already covered by the exact baseline (created before the reconcile anchor)', async () => {
    ingestSyncedRows('task', CHANNEL, [row('old-1', { createdAt: daysAgo(1) })]);
    await settle();

    expect(counts()[CHANNEL].task).toBe(5);
  });

  it('does not count rows outside the seen window or rows this client already saw', async () => {
    vi.advanceTimersByTime(10);
    useSeenStore.getState().markEntitySeen('tenant-1', ORG, CHANNEL, 'task', 'seen-1');
    await settle(); // markEntitySeen itself queued a -1 (5 → 4)

    ingestSyncedRows('task', CHANNEL, [
      row('ancient', { createdAt: daysAgo(120) }), // outside 90-day window
      row('seen-1'), // locally seen
    ]);
    await settle();

    expect(counts()[CHANNEL].task).toBe(4);
  });

  it('decrements for a tombstoned baseline row, and nets zero for a row it counted itself', async () => {
    // Baseline row soft-deleted → −1 (5 → 4)
    ingestSyncedRows('task', CHANNEL, [row('base-1', { createdAt: daysAgo(1), deletedAt: now() })]);
    await settle();
    expect(counts()[CHANNEL].task).toBe(4);

    // Live row: +1 then tombstone −1 → net zero
    vi.advanceTimersByTime(10);
    ingestSyncedRows('task', CHANNEL, [row('live-1')]);
    await settle();
    expect(counts()[CHANNEL].task).toBe(5);
    ingestSyncedRows('task', CHANNEL, [row('live-1', { deletedAt: now() })]);
    await settle();
    expect(counts()[CHANNEL].task).toBe(4);
  });

  it('reconcile wins wholesale: after noteUnseenReconciled, re-ingested rows are baseline rows', async () => {
    vi.advanceTimersByTime(10);
    ingestSyncedRows('task', CHANNEL, [row('a2')]);
    await settle();
    expect(counts()[CHANNEL].task).toBe(6);

    noteUnseenReconciled(); // exact recount replaced the cache; anchor moves forward
    ingestSyncedRows('task', CHANNEL, [row('a2')]); // same row again → baseline's job now
    await settle();
    expect(counts()[CHANNEL].task).toBe(6);
  });

  it('hard delete decrements unseen rows and nets zero for locally-seen ones', async () => {
    applyHardDeleteUnseen('task', 'gone-1', CHANNEL); // unseen → −1
    await settle();
    expect(counts()[CHANNEL].task).toBe(4);

    useSeenStore.getState().markEntitySeen('tenant-1', ORG, CHANNEL, 'task', 'gone-2');
    await settle(); // view-mark −1 (4 → 3)
    applyHardDeleteUnseen('task', 'gone-2', CHANNEL); // seen → net 0
    await settle();
    expect(counts()[CHANNEL].task).toBe(3);
  });

  it('derives the channel from the row (deepest ancestor id), falling back to the passed channel', async () => {
    vi.advanceTimersByTime(10);
    ingestSyncedRows('task', 'fallback-ch', [
      row('c1'), // row's own projectId (deepest ancestor) wins over the fallback
      { id: 'c2', createdAt: now(), deletedAt: null }, // no ancestor id at all → fallback
    ]);
    await settle();

    expect(counts()[CHANNEL].task).toBe(6);
    expect(counts()['fallback-ch'].task).toBe(1);
  });

  it('publish lights the badge: recency keys on publishedAt, not the old createdAt', async () => {
    vi.advanceTimersByTime(10);
    // Draft created 100 days ago, published just now: createdAt is outside the window AND
    // before the reconcile anchor — only the publishedAt recency key counts it as new.
    ingestSyncedRows('task', CHANNEL, [row('pub-1', { createdAt: daysAgo(100), publishedAt: now() })]);
    await settle();

    expect(counts()[CHANNEL].task).toBe(6);
  });

  it('never counts an unpublished draft (defense in depth — drafts do not sync at all)', async () => {
    vi.advanceTimersByTime(10);
    ingestSyncedRows('task', CHANNEL, [row('draft-1', { publishedAt: null })]);
    await settle();

    expect(counts()[CHANNEL].task).toBe(5);
  });

  it('ignores untracked entity types', async () => {
    ingestSyncedRows('page' as never, CHANNEL, [row('p1')]);
    await settle();
    expect(counts()[CHANNEL].task).toBe(5);
  });
});
