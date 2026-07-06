import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('shared', () => ({
  appConfig: {
    contextEntityTypes: ['organization'],
    entityIdColumnKeys: { organization: 'organizationId' },
  },
  hierarchy: {
    getOrderedAncestors: () => ['organization'],
  },
}));

vi.mock('~/modules/common/blocknote/yjs-editor', () => ({
  useYjsEditorStore: {
    getState: () => ({
      isActive: () => false,
      getOwnedFields: () => [],
    }),
  },
}));

vi.mock('~/query/offline', () => ({
  sourceId: 'test-source',
}));

vi.stubGlobal('window', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});
vi.stubGlobal('navigator', { onLine: true });

const { createEntityKeys } = await import('~/query/basic/create-query-keys');
const { registerEntityQueryKeys } = await import('~/query/basic/entity-query-registry');
const { queryClient } = await import('~/query/query-client');
const { fetchRangeAndPatch } = await import('./cache-ops');

describe('realtime cache ops', () => {
  afterEach(() => {
    queryClient.clear();
  });

  it('removes tombstone rows returned by seq range fetch', async () => {
    const keys = createEntityKeys<Record<string, never>>('attachment');
    registerEntityQueryKeys('attachment', keys, async () => ({
      items: [
        {
          id: 'attachment-1',
          organizationId: 'org-1',
          deletedAt: '2026-06-16T20:00:00.000Z',
        },
      ],
      total: 1,
    }));

    queryClient.setQueryData(keys.detail.byId('attachment-1'), { id: 'attachment-1', organizationId: 'org-1' });
    queryClient.setQueryData(keys.list.org('org-1'), {
      items: [{ id: 'attachment-1', organizationId: 'org-1' }],
      total: 1,
    });

    const patched = await fetchRangeAndPatch('attachment', 'org-1', 'tenant-1', '4,4', keys);

    expect(patched).toBe(true);
    expect(queryClient.getQueryData(keys.detail.byId('attachment-1'))).toBeUndefined();
    expect(queryClient.getQueryData(keys.list.org('org-1'))).toEqual({ items: [], total: 0 });
  });

  it('pages through seq chunks until the range is drained — no silent 1000-row delta cap', async () => {
    const keys = createEntityKeys<Record<string, never>>('attachment');
    const total = 1500;
    const all = Array.from({ length: total }, (_, i) => ({
      id: `att-${i + 1}`,
      organizationId: 'org-1',
      seq: i + 1,
    }));
    // Emulates the backend seq-read contract: filter by cursor bounds, seq order, cap at limit
    const deltaFetch = vi.fn(async (_org: string | null, _tenant: string | null, seqCursor: string) => {
      const [gteRaw, lteRaw] = seqCursor.split(',');
      const gte = Number(gteRaw);
      const lte = lteRaw === undefined ? Number.POSITIVE_INFINITY : Number(lteRaw);
      const matching = all.filter((r) => r.seq >= gte && r.seq <= lte);
      return { items: matching.slice(0, 1000), total: matching.length };
    });
    registerEntityQueryKeys('attachment', keys, deltaFetch);

    const patched = await fetchRangeAndPatch('attachment', 'org-1', 'tenant-1', '1', keys);

    expect(patched).toBe(true);
    expect(deltaFetch).toHaveBeenCalledTimes(2);
    // Rows beyond the first chunk were ingested, not dropped
    expect(queryClient.getQueryData(keys.detail.byId('att-1500'))).toMatchObject({ seq: 1500 });
  });

  it('returns false on a rejected delta fetch so callers fall back to invalidation', async () => {
    const keys = createEntityKeys<Record<string, never>>('attachment');
    registerEntityQueryKeys('attachment', keys, async () => {
      throw new Error('network down');
    });

    const patched = await fetchRangeAndPatch('attachment', 'org-1', 'tenant-1', '5', keys);

    expect(patched).toBe(false);
  });
});
