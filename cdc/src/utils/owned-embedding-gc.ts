import { and, eq, getColumns, inArray, isNull, sql } from 'drizzle-orm';
import type { AnyPgColumn, AnyPgTable } from 'drizzle-orm/pg-core';
import { appConfig, type ProductEntityType } from 'shared';
import { getEntityTable } from '#/tables';
import { cdcDb } from '../lib/db';
import { log } from '../lib/pino';
import type { CdcRowData } from '../types';
import { isSoftDeleteTransition } from './is-soft-delete-transition';
import { stripChangedFieldsStx } from './strip-changed-fields';

/** Pre-resolved owned embedding with Drizzle column references, keyed by host product. */
interface ResolvedOwnedEmbedding {
  embeddedProduct: ProductEntityType;
  embeddedTable: AnyPgTable;
  embeddedColumns: Record<string, AnyPgColumn>;
  hostTable: AnyPgTable;
  hostColumn: AnyPgColumn;
  hostColumnName: string;
}

/**
 * Map lifecycle-'owned' productEmbeddings config to Drizzle references at module init.
 * Throws on misconfiguration so problems surface at startup, not at runtime.
 */
function resolveOwnedEmbeddings(): ReadonlyMap<ProductEntityType, ResolvedOwnedEmbedding[]> {
  const map = new Map<ProductEntityType, ResolvedOwnedEmbedding[]>();

  for (const embedding of appConfig.productEmbeddings) {
    if (!('lifecycle' in embedding) || embedding.lifecycle !== 'owned') continue;
    const { embeddedProduct, hostProduct, hostColumn: hostColumnName } = embedding;

    const hostTable = getEntityTable(hostProduct as Parameters<typeof getEntityTable>[0]);
    const hostColumns = getColumns(hostTable) as Record<string, AnyPgColumn>;
    const hostColumn = hostColumns[hostColumnName];
    if (!hostColumn) throw new Error(`owned embedding: column "${hostColumnName}" not found on "${hostProduct}" table`);

    const embeddedTable = getEntityTable(embeddedProduct as Parameters<typeof getEntityTable>[0]);
    const embeddedColumns = getColumns(embeddedTable) as Record<string, AnyPgColumn>;
    for (const required of ['id', 'organizationId', 'deletedAt', 'deletedBy', 'updatedAt', 'updatedBy']) {
      if (!embeddedColumns[required])
        throw new Error(`owned embedding: column "${required}" not found on "${embeddedProduct}" table`);
    }

    const resolved: ResolvedOwnedEmbedding = { embeddedProduct, embeddedTable, embeddedColumns, hostTable, hostColumn, hostColumnName };
    const list = map.get(hostProduct);
    if (list) list.push(resolved);
    else map.set(hostProduct, [resolved]);
  }

  return map;
}

/** Owned embeddings keyed by HOST product type (host-side dispatch, unlike embedding-cleanup). */
const ownedByHostProduct = resolveOwnedEmbeddings();

const toIdArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

/** Per-organization removal candidates with the actor to attribute the soft-delete to. */
interface OrgCandidates {
  ids: Set<string>;
  actorId: string | null;
}

/**
 * Garbage-collect owned embedded rows after their host arrays shrink.
 *
 * Dispatch is host-type-first: call this only for update batches of a product that is a
 * registered owned-embedding HOST. Removal candidates are ids observed leaving a host
 * array (soft-deleted hosts surrender their whole array); a candidate is soft-deleted
 * only when no live host row in the organization still references it. Rows never
 * referenced by any host (e.g. project-level attachments) are structurally exempt:
 * only observed removals become candidates.
 *
 * The embedded row's soft-delete is a plain product UPDATE, so it flows through the
 * normal pipeline (seq stamp, activity, counter delta, propagation.remove hint).
 */
export async function gcOwnedEmbeddedRows(
  hostProductType: ProductEntityType,
  events: { result: { rowData: CdcRowData; oldRowData?: CdcRowData | null } }[],
): Promise<void> {
  const embeddings = ownedByHostProduct.get(hostProductType);
  if (!embeddings?.length) return;

  for (const { embeddedProduct, embeddedTable, embeddedColumns, hostTable, hostColumn, hostColumnName } of embeddings) {
    // Group removal candidates by organization (the GC scope boundary)
    const byOrg = new Map<string, OrgCandidates>();

    for (const { result } of events) {
      const newRow = result.rowData;
      const oldRow = result.oldRowData;
      // No old image (REPLICA IDENTITY not FULL): nothing safe to diff
      if (!oldRow) continue;

      const oldIds = toIdArray(oldRow[hostColumnName]);
      if (oldIds.length === 0) continue;

      const removed = isSoftDeleteTransition(newRow, oldRow)
        ? oldIds
        : (() => {
            const kept = new Set(toIdArray(newRow[hostColumnName]));
            return oldIds.filter((id) => !kept.has(id));
          })();
      if (removed.length === 0) continue;

      const organizationId = newRow.organizationId;
      if (typeof organizationId !== 'string') {
        log.warn('gcOwnedEmbeddedRows: missing organizationId on host row', { id: newRow.id });
        continue;
      }

      const actor = newRow.deletedBy ?? newRow.updatedBy;
      const group = byOrg.get(organizationId) ?? { ids: new Set<string>(), actorId: null };
      for (const id of removed) group.ids.add(id);
      if (typeof actor === 'string') group.actorId = actor;
      byOrg.set(organizationId, group);
    }

    if (byOrg.size === 0) continue;

    await Promise.all(
      [...byOrg].map(async ([organizationId, { ids, actorId }]) => {
        const candidates = [...ids];
        try {
          // WAL events arrive post-commit, so host arrays already reflect the removal:
          // any candidate still present in a live host row is referenced and survives.
          const referencedRows = await cdcDb
            .selectDistinct({ id: sql<string>`referenced.id` })
            .from(sql`${hostTable}, unnest(${hostColumn}) AS referenced(id)`)
            .where(
              and(
                sql`${(getColumns(hostTable) as Record<string, AnyPgColumn>).organizationId} = ${organizationId}`,
                isNull((getColumns(hostTable) as Record<string, AnyPgColumn>).deletedAt),
                sql`referenced.id = ANY(${candidates})`,
              ),
            );
          const referenced = new Set(referencedRows.map((row) => row.id));
          const orphanIds = candidates.filter((id) => !referenced.has(id));
          if (orphanIds.length === 0) return;

          const now = new Date().toISOString();
          const deleted = await cdcDb
            .update(embeddedTable)
            .set({
              deletedAt: now,
              deletedBy: actorId,
              updatedAt: now,
              updatedBy: actorId,
              stx: stripChangedFieldsStx(),
            })
            .where(
              and(
                inArray(embeddedColumns.id, orphanIds),
                eq(embeddedColumns.organizationId, organizationId),
                isNull(embeddedColumns.deletedAt),
              ),
            )
            .returning({ id: embeddedColumns.id });

          if (deleted.length > 0) {
            log.info('Owned embedded rows garbage-collected', {
              embeddedProduct,
              organizationId,
              count: deleted.length,
            });
          }
        } catch (err) {
          // The flush pipeline acks the WAL position regardless; a failed GC batch is a
          // leak, never a wrong delete. Log the ids so leaks stay diagnosable.
          log.error('gcOwnedEmbeddedRows failed; candidates leaked', { embeddedProduct, organizationId, candidates, err });
        }
      }),
    );
  }
}
