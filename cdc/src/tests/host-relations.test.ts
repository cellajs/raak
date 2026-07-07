import { describe, expect, it, vi } from 'vitest';
import type { InsertActivityModel } from '#/modules/activities/activities-db';
import type { ParseMessageResult } from '../pipeline/parse-message';
import { TransactionBuffer } from '../services/transaction-buffer';
import type { EntityTableMeta } from '../types';
import { getCountDeltas } from '../utils/update-counts';
import { mockParseResult } from './factories';

const attachmentMeta = (): EntityTableMeta =>
  ({ kind: 'entity', type: 'attachment', table: {} }) as unknown as EntityTableMeta;

const attachmentActivity = (action: string): InsertActivityModel =>
  ({
    action,
    entityType: 'attachment',
    organizationId: 'org-1',
  }) as unknown as InsertActivityModel;

// Host relationship behavior (hierarchy `host:`, raak: attachment → task): update-counts
// maintains e:attachment per host task, and the transaction buffer suppresses hosted-row
// hard-deletes cascading from a host hard-delete in the same transaction.
describe('host counters (update-counts)', () => {
  it('create with a host id → +1 e:attachment on the task', () => {
    const deltas = getCountDeltas(
      attachmentMeta(),
      attachmentActivity('create'),
      { id: 'att-1', taskId: 'task-1' },
      null,
    );
    expect(deltas).toContainEqual({ contextKey: 'task-1', deltas: { 'e:attachment': 1 } });
  });

  it('create without a host id → no host delta', () => {
    const deltas = getCountDeltas(attachmentMeta(), attachmentActivity('create'), { id: 'att-1', taskId: null }, null);
    expect(deltas.some((d) => d.contextKey === 'task-1')).toBe(false);
  });

  it('soft-delete transition → -1 e:attachment on the task', () => {
    const deltas = getCountDeltas(
      attachmentMeta(),
      attachmentActivity('update'),
      { id: 'att-1', taskId: 'task-1', deletedAt: '2026-07-06T12:00:00Z' },
      { id: 'att-1', taskId: 'task-1', deletedAt: null },
    );
    expect(deltas).toContainEqual({ contextKey: 'task-1', deltas: { 'e:attachment': -1 } });
  });

  it('hard delete → -1 e:attachment on the task (host id from the old row)', () => {
    const deltas = getCountDeltas(attachmentMeta(), attachmentActivity('delete'), { id: 'att-1' }, {
      id: 'att-1',
      taskId: 'task-1',
    });
    expect(deltas).toContainEqual({ contextKey: 'task-1', deltas: { 'e:attachment': -1 } });
  });

  it('re-host update → -1 on the old task, +1 on the new one', () => {
    const deltas = getCountDeltas(
      attachmentMeta(),
      attachmentActivity('update'),
      { id: 'att-1', taskId: 'task-2', deletedAt: null },
      { id: 'att-1', taskId: 'task-1', deletedAt: null },
    );
    expect(deltas).toContainEqual({ contextKey: 'task-1', deltas: { 'e:attachment': -1 } });
    expect(deltas).toContainEqual({ contextKey: 'task-2', deltas: { 'e:attachment': 1 } });
  });

  it('plain update without host change → no host delta', () => {
    const deltas = getCountDeltas(
      attachmentMeta(),
      attachmentActivity('update'),
      { id: 'att-1', taskId: 'task-1', deletedAt: null },
      { id: 'att-1', taskId: 'task-1', deletedAt: null },
    );
    expect(deltas.some((d) => d.contextKey === 'task-1')).toBe(false);
  });
});

describe('host cascade suppression (transaction buffer)', () => {
  const hostedDelete = (subjectId: string, taskId: string | null): ParseMessageResult => {
    const result = mockParseResult({ action: 'delete', entityType: 'attachment', subjectId });
    result.rowData = { ...result.rowData, taskId };
    return result;
  };

  const setup = () => {
    const processed: ParseMessageResult[] = [];
    const buffer = new TransactionBuffer(
      vi.fn(async (events) => {
        for (const event of events) processed.push(event.result);
      }),
    );
    return { processed, buffer };
  };

  it('suppresses hosted-row deletes cascading from a host delete in the same tx', async () => {
    const { processed, buffer } = setup();
    buffer.onBegin({ tag: 'begin', xid: 7, commitLsn: null, commitTime: BigInt(0) });

    await buffer.onEvent('0/1', mockParseResult({ action: 'delete', entityType: 'task', subjectId: 'task-1' }));
    await buffer.onEvent('0/2', hostedDelete('att-1', 'task-1'));
    await buffer.onEvent('0/3', hostedDelete('att-2', 'task-1'));
    // Hosted by a DIFFERENT task, must survive
    await buffer.onEvent('0/4', hostedDelete('att-3', 'task-9'));
    await buffer.onCommit();

    const ids = processed.map((r) => r.activity.subjectId);
    expect(ids).toContain('task-1');
    expect(ids).toContain('att-3');
    expect(ids).not.toContain('att-1');
    expect(ids).not.toContain('att-2');
  });

  it('second pass catches hosted deletes that arrive before the host delete', async () => {
    const { processed, buffer } = setup();
    buffer.onBegin({ tag: 'begin', xid: 8, commitLsn: null, commitTime: BigInt(0) });

    await buffer.onEvent('0/1', hostedDelete('att-1', 'task-1'));
    await buffer.onEvent('0/2', mockParseResult({ action: 'delete', entityType: 'task', subjectId: 'task-1' }));
    await buffer.onCommit();

    const ids = processed.map((r) => r.activity.subjectId);
    expect(ids).toEqual(['task-1']);
  });

  it('does not suppress hosted soft-delete tombstone updates', async () => {
    const { processed, buffer } = setup();
    buffer.onBegin({ tag: 'begin', xid: 9, commitLsn: null, commitTime: BigInt(0) });

    await buffer.onEvent('0/1', mockParseResult({ action: 'delete', entityType: 'task', subjectId: 'task-1' }));
    const tombstone = mockParseResult({ action: 'update', entityType: 'attachment', subjectId: 'att-1' });
    tombstone.rowData = { ...tombstone.rowData, taskId: 'task-1', deletedAt: '2026-07-06T12:00:00Z' };
    await buffer.onEvent('0/2', tombstone);
    await buffer.onCommit();

    const ids = processed.map((r) => r.activity.subjectId);
    expect(ids).toContain('att-1');
  });
});
