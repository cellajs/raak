import { describe, expect, it } from 'vitest';
import type { ActivityEvent } from '#/lib/activity-bus';
import { buildStreamNotification } from './build-message';

const labelEvent = (overrides: Record<string, unknown>): ActivityEvent =>
  ({
    id: 'activity-1',
    type: 'label.updated',
    action: 'update',
    entityType: 'label',
    resourceType: null,
    tableName: 'labels',
    subjectId: 'label-1',
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    projectId: 'project-1',
    rowData: { id: 'label-1', organizationId: 'org-1', projectId: 'project-1', deletedAt: null },
    seq: 11,
    batchUntilSeq: null,
    propagation: null,
    trace: null,
    stx: null,
    ...overrides,
  }) as unknown as ActivityEvent;

// Hint shape drives whether hosts refresh or strip their embedded copies (task.labels).
// Soft deletes ride the wire as updates, so classification must read the row, not the action.
describe('buildStreamNotification propagation hint', () => {
  it('classifies a live label update as an update hint', () => {
    const { propagation } = buildStreamNotification(labelEvent({}));
    expect(propagation).toMatchObject({ update: ['label-1'], remove: [] });
  });

  it('classifies a soft-deleted label row as a removal hint', () => {
    const { propagation } = buildStreamNotification(
      labelEvent({
        rowData: { id: 'label-1', organizationId: 'org-1', projectId: 'project-1', deletedAt: '2026-07-26T21:00:00Z' },
      }),
    );
    expect(propagation).toMatchObject({ update: [], remove: ['label-1'] });
  });

  it('classifies a hard delete as a removal hint', () => {
    const { propagation } = buildStreamNotification(labelEvent({ action: 'delete', rowData: null }));
    expect(propagation).toMatchObject({ update: [], remove: ['label-1'] });
  });
});
