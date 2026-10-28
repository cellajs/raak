import type { ActorContext } from '#/core/context';
import { AppError } from '#/core/error';
import { findLiveLabelModes, findLivePrimaryLabels, lockProjectForPrimaryLabels } from '#/modules/label/label-queries';
import { getValidChannel } from '#/permissions';

/**
 * Filter a permitted delete set by the primary-label rules: deleting a primary label
 * requires project-admin authority, and a project must always keep at least one live
 * primary label. Rejected ids are added to `rejected`; the returned array is the ids
 * that may actually be deleted. Must run inside a tenant context.
 */
export const filterPrimaryLabelDeletes = async (
  ctx: ActorContext,
  ids: string[],
  rejected: Set<string>,
): Promise<{ allowedIds: string[]; deletedPrimaryIds: string[] }> => {
  const rows = await findLiveLabelModes(ctx, { ids });

  const primariesByProject = Map.groupBy(
    rows.filter((row) => row.mode === 'primary'),
    (row) => row.projectId,
  );

  // In project id order, so two deletes that lock the same projects lock them in one order
  for (const [projectId, primaries] of [...primariesByProject].sort(([a], [b]) => a.localeCompare(b))) {
    try {
      await getValidChannel(ctx, projectId, 'project', 'update');
    } catch (error) {
      if (!(error instanceof AppError) || (error.status !== 403 && error.status !== 404)) throw error;
      for (const { id } of primaries) rejected.add(id);
      continue;
    }
    await lockProjectForPrimaryLabels(ctx, { projectId });
    // Read after the lock: a primary label another delete removed meanwhile is neither counted nor rejected
    const liveIds = new Set((await findLivePrimaryLabels(ctx, { projectIds: [projectId] })).map(({ id }) => id));
    const livePrimaries = primaries.filter(({ id }) => liveIds.has(id));
    // A project keeps at least one live primary label; when the batch would drop below that,
    // every primary id in the batch for this project is rejected (no partial keep).
    if (liveIds.size - livePrimaries.length < 1) {
      for (const { id } of livePrimaries) rejected.add(id);
    }
  }

  const allowedIds = ids.filter((id) => !rejected.has(id));
  const allowedSet = new Set(allowedIds);
  const deletedPrimaryIds = [...primariesByProject.values()]
    .flat()
    .map(({ id }) => id)
    .filter((id) => allowedSet.has(id));
  return { allowedIds, deletedPrimaryIds };
};
