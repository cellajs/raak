import { and, asc, count, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { PrimaryLabelDefinition } from 'shared';
import { defaultOrder, orderGap } from 'shared/utils/display-order';
import type { AuthContext, DbContext } from '#/core/context';
import { createServerStx } from '#/core/stx';
import { type InsertLabelModel, type LabelModel, labelsTable } from '#/modules/label/label-db';
import { tasksTable } from '#/modules/task/task-db';
import { getValidChannel } from '#/permissions';
import { getIsoDate } from '#/utils/iso-date';

interface BuildPrimaryLabelRowsOpts {
  entries: PrimaryLabelDefinition[];
  projectId: string;
  organizationId: string;
  tenantId: string;
  createdBy: string | null;
}

/**
 * Build insertable tracked primary label rows for one project from the organization's
 * setupConfig entries. Array order becomes displayOrder; the first row is the default
 * primary label for new tasks in the project.
 */
export const buildPrimaryLabelRows = ({
  entries,
  projectId,
  organizationId,
  tenantId,
  createdBy,
}: BuildPrimaryLabelRowsOpts): InsertLabelModel[] => {
  const createdAt = getIsoDate();
  return entries.map((entry, index) => ({
    entityType: 'label' as const,
    name: entry.name,
    slug: entry.slug,
    color: entry.color,
    icon: entry.icon,
    mode: 'primary' as const,
    organizationTracked: true,
    displayOrder: defaultOrder + index * orderGap,
    projectId,
    organizationId,
    tenantId,
    createdAt,
    createdBy,
    stx: createServerStx(),
  }));
};

interface PropagateSetupConfigLabelsOpts {
  entries: PrimaryLabelDefinition[];
  organizationId: string;
  updatedBy: string;
}

/**
 * Live primary labels for a set of projects, ordered by displayOrder (default first).
 * Must run inside a tenant context (labels are FORCE-RLS).
 */
export const findLivePrimaryLabels = async (
  ctx: DbContext,
  { projectIds }: { projectIds: string[] },
): Promise<LabelModel[]> => {
  if (projectIds.length === 0) return [];
  const { db } = ctx.var;
  return db
    .select()
    .from(labelsTable)
    .where(
      and(inArray(labelsTable.projectId, projectIds), eq(labelsTable.mode, 'primary'), isNull(labelsTable.deletedAt)),
    )
    .orderBy(asc(labelsTable.displayOrder));
};

/** Slug of a label row by id (any mode or deletion state); null when the row is unknown. */
export const findLabelSlugById = async (ctx: DbContext, id: string): Promise<string | null> => {
  const { db } = ctx.var;
  const [row] = await db.select({ slug: labelsTable.slug }).from(labelsTable).where(eq(labelsTable.id, id)).limit(1);
  return row?.slug ?? null;
};

/**
 * Reassign tasks referencing soft-deleted primary labels to their project's default
 * (first remaining live primary by displayOrder). Runs synchronously in the delete
 * transaction because tasks.primaryLabelId is NOT NULL; server-origin stx write.
 */
export const reassignTasksFromDeletedPrimaries = async (
  ctx: DbContext,
  { deletedPrimaryIds, updatedBy }: { deletedPrimaryIds: string[]; updatedBy: string },
): Promise<void> => {
  if (deletedPrimaryIds.length === 0) return;
  const { db } = ctx.var;
  await db
    .update(tasksTable)
    .set({
      primaryLabelId: sql`(
        SELECT l.id FROM labels l
        WHERE l.project_id = ${tasksTable.projectId}
          AND l.mode = 'primary'
          AND l.deleted_at IS NULL
          AND NOT (l.id = ANY(${deletedPrimaryIds}::uuid[]))
        ORDER BY l.display_order ASC NULLS LAST
        LIMIT 1
      )`,
      updatedAt: getIsoDate(),
      updatedBy,
      stx: sql`stx - 'changedFields'`,
    })
    .where(inArray(tasksTable.primaryLabelId, deletedPrimaryIds));
};

/**
 * Filter a permitted delete set by the primary-label rules: deleting a primary label
 * requires project-admin authority, and a project must always keep at least one live
 * primary label. Rejected ids are added to `rejected`; the returned array is the ids
 * that may actually be deleted. Must run inside a tenant context.
 */
export const filterPrimaryLabelDeletes = async (
  ctx: AuthContext,
  ids: string[],
  rejected: Set<string>,
): Promise<{ allowedIds: string[]; deletedPrimaryIds: string[] }> => {
  if (ids.length === 0) return { allowedIds: ids, deletedPrimaryIds: [] };
  const { db } = ctx.var;

  const rows = await db
    .select({ id: labelsTable.id, mode: labelsTable.mode, projectId: labelsTable.projectId })
    .from(labelsTable)
    .where(and(inArray(labelsTable.id, ids), isNull(labelsTable.deletedAt)));

  const primariesByProject = new Map<string, string[]>();
  for (const row of rows) {
    if (row.mode !== 'primary') continue;
    primariesByProject.set(row.projectId, [...(primariesByProject.get(row.projectId) ?? []), row.id]);
  }

  for (const [projectId, primaryIds] of primariesByProject) {
    try {
      await getValidChannel(ctx, projectId, 'project', 'update');
    } catch {
      for (const id of primaryIds) rejected.add(id);
      continue;
    }
    const [{ liveCount }] = await db
      .select({ liveCount: count() })
      .from(labelsTable)
      .where(and(eq(labelsTable.projectId, projectId), eq(labelsTable.mode, 'primary'), isNull(labelsTable.deletedAt)));
    // A project keeps at least one live primary label; reject the whole batch for the project
    // rather than silently keeping an arbitrary subset.
    if (liveCount - primaryIds.length < 1) {
      for (const id of primaryIds) rejected.add(id);
    }
  }

  const allowedIds = ids.filter((id) => !rejected.has(id));
  const allowedSet = new Set(allowedIds);
  const deletedPrimaryIds = [...primariesByProject.values()].flat().filter((id) => allowedSet.has(id));
  return { allowedIds, deletedPrimaryIds };
};

/**
 * Propagate edited setupConfig entries onto still-tracked primary rows across all of the
 * organization's projects, matched by slug. Unlinked rows (organizationTracked=false) and
 * per-project displayOrder are left alone. Server-origin write: stripping stx.changedFields
 * makes CDC attribute the change from the WAL diff (same convention as CDC rewrites).
 * Must run inside a tenant context (labels are FORCE-RLS).
 */
export const propagateSetupConfigLabels = async (
  ctx: DbContext,
  { entries, organizationId, updatedBy }: PropagateSetupConfigLabelsOpts,
): Promise<void> => {
  const { db } = ctx.var;
  const updatedAt = getIsoDate();
  for (const entry of entries) {
    await db
      .update(labelsTable)
      .set({
        name: entry.name,
        color: entry.color,
        icon: entry.icon,
        updatedAt,
        updatedBy,
        stx: sql`stx - 'changedFields'`,
      })
      .where(
        and(
          eq(labelsTable.organizationId, organizationId),
          eq(labelsTable.slug, entry.slug),
          eq(labelsTable.mode, 'primary'),
          eq(labelsTable.organizationTracked, true),
          isNull(labelsTable.deletedAt),
        ),
      );
  }
};
