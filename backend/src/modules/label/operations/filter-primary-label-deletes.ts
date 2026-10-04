import type { ActorContext } from '#/core/context';
import { countLivePrimaryLabels, findLiveLabelModes } from '#/modules/label/label-queries';
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
  if (ids.length === 0) return { allowedIds: ids, deletedPrimaryIds: [] };

  const rows = await findLiveLabelModes(ctx, { ids });

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
    const liveCount = await countLivePrimaryLabels(ctx, { projectId });
    // A project keeps at least one live primary label; when the batch would drop below that,
    // every primary id in the batch for this project is rejected (no partial keep).
    if (liveCount - primaryIds.length < 1) {
      for (const id of primaryIds) rejected.add(id);
    }
  }

  const allowedIds = ids.filter((id) => !rejected.has(id));
  const allowedSet = new Set(allowedIds);
  const deletedPrimaryIds = [...primariesByProject.values()].flat().filter((id) => allowedSet.has(id));
  return { allowedIds, deletedPrimaryIds };
};
