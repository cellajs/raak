import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDb as db, seedDb } from '#/db/db';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import { mockAttachment } from '#/modules/attachment/attachment-mocks';
import { channelCountersTable } from '#/modules/entities/channel-counters-db';
import { recalculateCounters } from '#/modules/entities/helpers/recalculate-counters';
import { clearSecurityTestData, createTestTenant, type TestTenant } from './security/helpers';
import { createAppClient } from './test-client';
import { mockFetchRequest, setTestConfig } from './test-utils';

setTestConfig({ enabledAuthStrategies: ['passkey'] });

/**
 * Counter recalculation (the drift/incident repair tool; its output IS the contract) must
 * agree with CDC's incremental sequence writes: `sequence` = max stamped seq across the
 * org's product tables, `f:{type}` = max seq per (node, type), `e:{type}` = live published.
 */
describe('recalculateCounters (sequence + frontier)', async () => {
  const call = await createAppClient();
  let tenant: TestTenant;

  // Raak's attachment is project-homed (parent: project), not org-homed like base cella's:
  // the self family (fs:/es:) rolls up to the DEEPEST ancestor (projectId), not the org. All
  // three rows share one project so the self counters land at a single, assertable key.
  const projectId = crypto.randomUUID();

  beforeAll(async () => {
    mockFetchRequest();
    tenant = await createTestTenant(call, 'recalc-sequence');

    const base = (key: string, seq: number, extra: Record<string, unknown> = {}) => {
      // Strip generated/select-only fields; bind to the test tenant/org/project; audit users
      // nulled (mock ids have no users rows and the columns are nullable FKs).
      const { path: _path, ...row } = mockAttachment(key) as unknown as Record<string, unknown>;
      return {
        ...row,
        tenantId: tenant.tenantId,
        organizationId: tenant.organization.id,
        projectId,
        createdBy: null,
        updatedBy: null,
        deletedBy: null,
        seq,
        ...extra,
      };
    };

    await seedDb.insert(attachmentsTable).values([
      base('recalc:a1', 41) as never,
      base('recalc:a2', 44) as never,
      // Tombstone keeps its seq: counts exclude it, frontier includes it.
      base('recalc:a3', 47, { deletedAt: '2026-07-10T00:00:00.000Z' }) as never,
    ]);
  });

  afterAll(async () => {
    await seedDb.execute(sql`DELETE FROM attachments WHERE organization_id = ${tenant.organization.id}`);
    await seedDb.execute(sql`DELETE FROM channel_counters WHERE channel_key = ${tenant.organization.id}`);
    await seedDb.execute(sql`DELETE FROM channel_counters WHERE channel_key = ${projectId}`);
    await clearSecurityTestData();
  });

  it('rebuilds sequence, f:attachment and e:attachment from row state', async () => {
    await recalculateCounters(db);

    const [row] = await db
      .select({ counts: channelCountersTable.counts, path: channelCountersTable.path })
      .from(channelCountersTable)
      .where(sql`channel_key = ${tenant.organization.id}`);

    const counts = row.counts as Record<string, number>;
    // Path backfill: the org channel's canonical path is its own id.
    expect(row.path).toBe(tenant.organization.id);
    // Sequence reservation counter: max stamped value across product tables.
    expect(counts.sequence).toBe(47);
    // Frontier includes tombstones (they keep their seq for delta reads).
    expect(counts['f:attachment']).toBe(47);
    // Live count excludes the soft-deleted row.
    expect(counts['e:attachment']).toBe(2);

    // Self family (attachments are project-homed in raak, so self == the shared project
    // node, NOT the org node): check the rollup at the deepest ancestor, projectId.
    const [projectRow] = await db
      .select({ counts: channelCountersTable.counts })
      .from(channelCountersTable)
      .where(sql`channel_key = ${projectId}`);
    const projectCounts = projectRow.counts as Record<string, number>;
    expect(projectCounts['fs:attachment']).toBe(47);
    expect(projectCounts['es:attachment']).toBe(2);
  });
});
