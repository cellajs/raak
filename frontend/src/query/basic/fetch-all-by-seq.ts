import type { QueryData } from '~/query/types';

/**
 * Chunk size for seq-keyset reads (canonical hydration + delta sync).
 * Matches the backend's max limit; a full chunk means "more to fetch".
 */
export const SYNC_CHUNK_SIZE = 1000;

type SeqItem = { id: string; seq?: number | null };

type SeqChunkFetcher<T> = (params: { seqCursor: string; limit: string }) => Promise<QueryData<T>>;

interface FetchAllBySeqOpts {
  /** Inclusive lower seq bound to start from (default 0 — full hydration). */
  gte?: number;
  /** Inclusive upper seq bound (bounded delta ranges from batch notifications). */
  lte?: number;
  chunkSize?: number;
}

/**
 * Fetches a complete seq-keyset read: loops seq-ordered chunks until a short chunk signals
 * the end. The backend orders seq reads by (seq, id), so a limit-capped chunk is a clean
 * prefix and the loop resumes from the highest seq received.
 *
 * The cursor advance is INCLUSIVE (next chunk starts at maxSeq, not maxSeq + 1): seq counters
 * are per context (e.g. per project), so an org-wide read can contain duplicate seq values and
 * an exclusive cursor could skip ties at a chunk boundary. Boundary rows re-fetch once and
 * dedupe by id (last occurrence wins — a row re-stamped mid-loop reappears with newer data).
 *
 * Unlike offset paging, concurrent writes cannot cause rows to be missed: a row changed
 * mid-loop gets a higher seq from the CDC worker and shows up in a later chunk.
 *
 * Returns `maxSeq` — the highest seq ingested — for use as a sync cursor baseline.
 */
export async function fetchAllBySeq<T extends SeqItem>(
  fetcher: SeqChunkFetcher<T>,
  { gte = 0, lte, chunkSize = SYNC_CHUNK_SIZE }: FetchAllBySeqOpts = {},
): Promise<QueryData<T> & { maxSeq: number }> {
  const byId = new Map<string, T>();
  let cursor = gte;
  let maxSeq = 0;
  let total = 0;
  let firstChunk = true;

  while (true) {
    const seqCursor = lte === undefined ? String(cursor) : `${cursor},${lte}`;
    const chunk = await fetcher({ seqCursor, limit: String(chunkSize) });

    // Later chunks count only the remaining seq range; the first chunk's total is the full set
    if (firstChunk) {
      total = chunk.total;
      firstChunk = false;
    }

    let newIds = 0;
    for (const item of chunk.items) {
      if (!byId.has(item.id)) newIds++;
      byId.set(item.id, item);
      if (typeof item.seq === 'number' && item.seq > maxSeq) maxSeq = item.seq;
    }

    if (chunk.items.length < chunkSize) break;

    // Advance inclusively; if a full chunk brought nothing new (>= chunkSize ties on one seq,
    // pathological), bump past the tie to guarantee progress.
    cursor = maxSeq > cursor ? maxSeq : cursor + (newIds === 0 ? 1 : 0);
  }

  return { items: [...byId.values()], total, maxSeq };
}
