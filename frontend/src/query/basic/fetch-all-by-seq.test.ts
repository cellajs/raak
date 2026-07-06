import { describe, expect, it, vi } from 'vitest';
import { fetchAllBySeq } from './fetch-all-by-seq';

type Row = { id: string; seq: number; name?: string };

/**
 * Emulates the backend seq-read contract: filter by seqCursor bounds ("gte" or "gte,lte"),
 * order by (seq, id), cap at limit. `mutate` lets a test change the dataset between chunks
 * (concurrent-write simulation).
 */
const serve = (rows: Row[], mutate?: (callIndex: number) => void) => {
  let call = 0;
  const fetcher = vi.fn(async ({ seqCursor, limit }: { seqCursor: string; limit: string }) => {
    mutate?.(call++);
    const [gteRaw, lteRaw] = seqCursor.split(',');
    const gte = Number(gteRaw);
    const lte = lteRaw === undefined ? Number.POSITIVE_INFINITY : Number(lteRaw);
    const matching = rows
      .filter((r) => r.seq >= gte && r.seq <= lte)
      .sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id));
    return { items: matching.slice(0, Number(limit)), total: matching.length };
  });
  return fetcher;
};

describe('fetchAllBySeq', () => {
  it('drains multiple chunks, dedupes inclusive-cursor boundary rows, reports maxSeq', async () => {
    const rows: Row[] = [1, 2, 3, 4, 5].map((seq) => ({ id: `t${seq}`, seq }));
    const fetcher = serve(rows);

    const result = await fetchAllBySeq(fetcher, { chunkSize: 2 });

    // Inclusive cursor re-fetches each chunk's boundary row; dedupe keeps items exact
    expect(result.items.map((r) => r.seq).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    expect(result.maxSeq).toBe(5);
    // total comes from the first chunk = the full matching set
    expect(result.total).toBe(5);
  });

  it('keeps the last occurrence when a row is re-stamped mid-loop (self-healing)', async () => {
    const rows: Row[] = [
      { id: 'a', seq: 1, name: 'stale' },
      { id: 'b', seq: 2 },
      { id: 'c', seq: 3 },
    ];
    // Concurrent write between chunk 1 and 2: row "a" is re-stamped with a higher seq
    const fetcher = serve(rows, (call) => {
      if (call === 1) rows[0] = { id: 'a', seq: 9, name: 'fresh' };
    });

    const result = await fetchAllBySeq(fetcher, { chunkSize: 2 });

    const a = result.items.filter((r) => r.id === 'a');
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ seq: 9, name: 'fresh' });
    expect(result.maxSeq).toBe(9);
  });

  it('respects a bounded lte range', async () => {
    const rows: Row[] = [1, 2, 3, 4, 5].map((seq) => ({ id: `t${seq}`, seq }));
    const fetcher = serve(rows);

    const result = await fetchAllBySeq(fetcher, { gte: 2, lte: 4, chunkSize: 2 });

    expect(result.items.map((r) => r.seq).sort((a, b) => a - b)).toEqual([2, 3, 4]);
    // Every chunk request carries both bounds
    for (const [{ seqCursor }] of fetcher.mock.calls) {
      expect(seqCursor.endsWith(',4')).toBe(true);
    }
  });

  it('progresses across a seq-tie plateau without skipping rows', async () => {
    // Cross-context duplicate seqs: a full chunk of identical seqs must not stall or skip
    const rows: Row[] = [
      { id: 'a', seq: 5 },
      { id: 'b', seq: 5 },
      { id: 'c', seq: 6 },
    ];
    const fetcher = serve(rows);

    const result = await fetchAllBySeq(fetcher, { chunkSize: 2 });

    expect(result.items.map((r) => r.id).sort()).toEqual(['a', 'b', 'c']);
    expect(result.maxSeq).toBe(6);
  });

  it('returns empty result with maxSeq 0 when nothing matches', async () => {
    const fetcher = serve([]);

    const result = await fetchAllBySeq(fetcher, { chunkSize: 2 });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.maxSeq).toBe(0);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
