import { deriveDescriptionProps } from '~/modules/common/blocknote/derive-description-props';
import { patchDescriptionCaches } from '~/modules/common/blocknote/description-cache';
import { taskKeys, useTaskUpdateMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { findInCache } from '~/query/basic/find-in-list-cache';

/**
 * Returns the task-description update policy.
 * Collaborative edits patch caches while Yjs persists; other edits use the update mutation.
 */
export const useTaskDescriptionUpdate = (task: Task) => {
  const { mutateAsync: updateDesc } = useTaskUpdateMutation(task.tenantId, task.organizationId);

  return async (description: string, collaborative: boolean) => {
    if (collaborative) {
      // Patch cache-derived fields until the relay persists authoritative values.
      const derived = await deriveDescriptionProps(description);
      patchDescriptionCaches(
        'task',
        task.id,
        { detailKey: taskKeys.detail.byId(task.id), listKey: taskKeys.list.org(task.organizationId) },
        { description, ...derived, updatedAt: new Date().toISOString() },
      );
      return;
    }

    // Non-collab: persist via the standard mutation (offline queue, HLC, optimistic cache).
    // Skip if the task was deleted (e.g. unmount flush after deletion).
    if (!findInCache<Task>('task', task.id)) return;
    const { summary, summaryLength } = await deriveDescriptionProps(description);
    await updateDesc({ id: task.id, ops: { description }, summary, summaryLength });
  };
};
