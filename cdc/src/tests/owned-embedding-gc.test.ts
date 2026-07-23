import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CdcRowData } from '../types';

/** Ids the mocked refcount query reports as still referenced by a live host row. */
let referencedIds: string[] = [];
/** Captured update calls: the set() values and the ids passed to inArray (via returning stub). */
const updates: Array<{ values: Record<string, unknown> }> = [];

vi.mock('../lib/db', () => ({
  cdcDb: {
    selectDistinct: vi.fn(() => ({
      from: () => ({
        where: async () => referencedIds.map((id) => ({ id })),
      }),
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          returning: async () => {
            updates.push({ values });
            return [{ id: 'deleted' }];
          },
        }),
      }),
    })),
  },
}));

const { gcOwnedEmbeddedRows } = await import('../utils/owned-embedding-gc');

const hostEvent = (rowData: Record<string, unknown>, oldRowData: Record<string, unknown> | null) => ({
  result: { rowData: rowData as CdcRowData, oldRowData: oldRowData as CdcRowData | null },
});

const base = { id: 'task-1', organizationId: 'org-1', updatedBy: 'user-1', deletedAt: null, deletedBy: null };

beforeEach(() => {
  referencedIds = [];
  updates.length = 0;
});

// Raak config registers { embeddedProduct: 'attachment', hostProduct: 'task',
// hostColumn: 'attachments', lifecycle: 'owned' }; these tests exercise that entry.
describe('gcOwnedEmbeddedRows', () => {
  it('soft-deletes ids that left the host array and are referenced nowhere else', async () => {
    await gcOwnedEmbeddedRows('task', [
      hostEvent({ ...base, attachments: ['a-1'] }, { ...base, attachments: ['a-1', 'a-2'] }),
    ]);
    expect(updates).toHaveLength(1);
    expect(updates[0].values.deletedAt).toBeTruthy();
    expect(updates[0].values.deletedBy).toBe('user-1');
    // stx strip must ride every CDC-driven write (echo-loop prevention)
    expect(updates[0].values.stx).toBeTruthy();
  });

  it('spares removed ids still referenced by another live host row', async () => {
    referencedIds = ['a-2'];
    await gcOwnedEmbeddedRows('task', [
      hostEvent({ ...base, attachments: [] }, { ...base, attachments: ['a-2'] }),
    ]);
    expect(updates).toHaveLength(0);
  });

  it('treats a host soft-delete transition as removing its entire array', async () => {
    await gcOwnedEmbeddedRows('task', [
      hostEvent(
        { ...base, deletedAt: '2026-01-01T00:00:00Z', deletedBy: 'user-9', attachments: ['a-1', 'a-2'] },
        { ...base, attachments: ['a-1', 'a-2'] },
      ),
    ]);
    expect(updates).toHaveLength(1);
    expect(updates[0].values.deletedBy).toBe('user-9');
  });

  it('ignores events without an old row image and hosts with no owned embedding', async () => {
    await gcOwnedEmbeddedRows('task', [hostEvent({ ...base, attachments: [] }, null)]);
    await gcOwnedEmbeddedRows('attachment', [
      hostEvent({ ...base, attachments: [] }, { ...base, attachments: ['a-1'] }),
    ]);
    expect(updates).toHaveLength(0);
  });

  it('does not GC when the array is unchanged', async () => {
    await gcOwnedEmbeddedRows('task', [
      hostEvent({ ...base, attachments: ['a-1'] }, { ...base, attachments: ['a-1'] }),
    ]);
    expect(updates).toHaveLength(0);
  });
});
