import { describe, expect, it } from 'vitest';
import type { ActivityEvent } from '#/lib/activity-bus';
import { buildStreamNotification } from './build-message';

const labelRow = (deletedAt: string | null = null) => ({
  rowData: { id: 'label-1', organizationId: 'org-1', projectId: 'project-1', deletedAt },
  seq: 11,
  movedFrom: null,
});

const labelEvent = (overrides: Record<string, unknown>): ActivityEvent =>
  ({
    id: 'activity-1',
    type: 'label.updated',
    action: 'update',
    entityType: 'label',
    resourceType: null,
    subjectId: 'label-1',
    tenantId: 'tenant-1',
    organizationId: 'org-1',
    projectId: 'project-1',
    rowData: null,
    rows: [labelRow()],
    trace: null,
    stx: null,
    ...overrides,
  }) as unknown as ActivityEvent;

// Hint shape drives whether hosts refresh or strip their embedded copies (task.labels).
// Soft deletes ride the wire as updates, so classification must read the row, not the action.
describe('buildStreamNotification propagation hint', () => {
  it('classifies a live label update as an update hint', () => {
    const { propagation } = buildStreamNotification(labelEvent({}));
    expect(propagation).toMatchObject({ hostProduct: 'task', update: ['label-1'], remove: [] });
  });

  it('classifies a soft-deleted label row as a removal hint', () => {
    const { propagation } = buildStreamNotification(labelEvent({ rows: [labelRow('2026-07-26T21:00:00Z')] }));
    expect(propagation).toMatchObject({ update: [], remove: ['label-1'] });
  });

  it('classifies a hard delete as a removal hint', () => {
    const { propagation } = buildStreamNotification(labelEvent({ action: 'delete' }));
    expect(propagation).toMatchObject({ update: [], remove: ['label-1'] });
  });
});
