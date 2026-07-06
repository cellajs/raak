/**
 * Task seq-read contract integration tests.
 *
 * Pins the seq-keyset read contract that canonical hydration + delta sync rely on:
 * - B1: `seqCursor` reads return seq-ascending order regardless of sort/order params,
 *   so a limit-capped page is a clean prefix the client can resume from.
 * - B2: tombstones require explicit `includeDeleted` opt-in (with seqCursor); hydration
 *   reads (seqCursor alone) exclude soft-deleted rows.
 * - B3: `limit` above 1000 is rejected (400), not clamped.
 * - B4: bounded `seqCursor` ("a,b") respects BOTH bounds — regression for the bug where
 *   seq filters joined the OR'd search group and "a,b" degenerated to all rows.
 * - B5: `seqCursor` composes with `acceptedCutOff` (delta window AND cutoff).
 *
 * Requires: PostgreSQL (core mode or higher)
 */

import { inArray } from 'drizzle-orm';
import { getTasks } from 'sdk';
import { generateId } from 'shared/entity-id';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDb as db } from '#/db/db';
import { projectsTable } from '#/modules/project/project-db';
import { tasksTable } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockStxBase } from '#/schemas/sync-transaction-mocks';
import { defaultHeaders } from './fixtures';
import { clearSecurityTestData, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { mockFetchRequest, setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

const projectId = generateId();
const taskIds = {
  seq10: generateId(),
  seq20: generateId(),
  seq30Deleted: generateId(),
  seq40OldAccepted: generateId(),
  seq50: generateId(),
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

describe('Task seq reads', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;

  const listTasks = async (query: Record<string, string | number>) => {
    const result = await call(getTasks, {
      path: { organizationId: tenant.organization.id, tenantId: tenant.tenantId },
      query: { projectId, ...query },
      headers: { ...defaultHeaders, Cookie: tenant.sessionCookie },
    });
    const data = result.data as { items: { id: string; seq: number; deletedAt: string | null }[] } | undefined;
    return { status: result.response.status, items: data?.items ?? [] };
  };

  beforeAll(async () => {
    mockFetchRequest();
    tenant = await createTestTenant(call, 'task-seq-reads');

    await db.insert(projectsTable).values({
      id: projectId,
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      name: 'Seq read project',
      slug: `seq-read-project-${projectId.slice(0, 8)}`,
      createdBy: tenant.user.id,
    });

    // Insert order is DESCENDING seq so createdAt order disagrees with seq order —
    // B1 would pass accidentally if the endpoint sorted by createdAt.
    const baseTask = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organization.id,
      projectId,
      summary: '',
      variant: 1,
      displayOrder: 1,
      status: TaskStatus.Unstarted,
      stx: mockStxBase(),
      createdBy: tenant.user.id,
    };
    const rows = [
      { ...baseTask, id: taskIds.seq50, name: 'seq 50', seq: 50 },
      {
        ...baseTask,
        id: taskIds.seq40OldAccepted,
        name: 'seq 40 old accepted',
        seq: 40,
        status: TaskStatus.Accepted,
        updatedAt: daysAgo(30),
      },
      { ...baseTask, id: taskIds.seq30Deleted, name: 'seq 30 tombstone', seq: 30, deletedAt: daysAgo(1) },
      { ...baseTask, id: taskIds.seq20, name: 'seq 20', seq: 20 },
      { ...baseTask, id: taskIds.seq10, name: 'seq 10', seq: 10 },
    ];
    for (const row of rows) {
      await db.insert(tasksTable).values(row);
    }
  });

  afterAll(async () => {
    await db.delete(tasksTable).where(inArray(tasksTable.id, Object.values(taskIds)));
    await db.delete(projectsTable).where(inArray(projectsTable.id, [projectId]));
    await clearSecurityTestData();
  });

  it('B1: seqCursor reads are seq-ascending; a capped page is a clean prefix', async () => {
    // sort/order params must NOT override seq ordering on seq reads
    const result = await listTasks({ seqCursor: '1', limit: '2', sort: 'createdAt', order: 'desc' });

    expect(result.status).toBe(200);
    // Live rows in seq order are 10, 20, 40, 50 (30 is a tombstone) — the capped
    // page must be exactly the two lowest seqs, nothing skipped below the cap.
    expect(result.items.map((t) => t.seq)).toEqual([10, 20]);
  });

  it('B2: tombstones flow only with seqCursor + includeDeleted', async () => {
    // Hydration read: seqCursor alone excludes soft-deleted rows
    const hydration = await listTasks({ seqCursor: '1', limit: '100' });
    expect(hydration.items.map((t) => t.seq)).toEqual([10, 20, 40, 50]);

    // Delta read: includeDeleted opts tombstones in
    const delta = await listTasks({ seqCursor: '1', includeDeleted: 'true', limit: '100' });
    expect(delta.items.map((t) => t.seq)).toEqual([10, 20, 30, 40, 50]);
    const tombstone = delta.items.find((t) => t.seq === 30);
    expect(tombstone?.deletedAt).not.toBeNull();

    // includeDeleted without seqCursor is ignored — normal reads never see tombstones
    const normal = await listTasks({ includeDeleted: 'true', limit: '100' });
    expect(normal.items.some((t) => t.id === taskIds.seq30Deleted)).toBe(false);
  });

  it('B3: limit above 1000 is rejected, not clamped', async () => {
    // Validation failures map to 403 via the app's defaultHook (not 400)
    const result = await listTasks({ limit: '1001' });
    expect(result.status).toBe(403);
    expect(result.items).toEqual([]);
  });

  it('B4: bounded seqCursor respects both bounds (seq-filter OR-group regression)', async () => {
    const result = await listTasks({ seqCursor: '20,40', includeDeleted: 'true', limit: '100' });

    expect(result.status).toBe(200);
    // Before the fix, "20,40" joined the OR'd search group as (seq >= 20 OR seq <= 40) = all rows
    expect(result.items.map((t) => t.seq)).toEqual([20, 30, 40]);
  });

  it('B5: seqCursor composes with acceptedCutOff', async () => {
    // acceptedCutOff is a number in the SDK contract (client-side zod validates it)
    const result = await listTasks({ seqCursor: '1', acceptedCutOff: 14, limit: '100' });

    expect(result.status).toBe(200);
    // seq 40 is Accepted with updatedAt 30 days ago — outside the 14-day window
    expect(result.items.map((t) => t.seq)).toEqual([10, 20, 50]);
  });
});
