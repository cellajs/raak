import { deriveDescriptionProps } from '~/modules/common/blocknote/derive-description-props';
import { patchDescriptionCaches } from '~/modules/common/blocknote/description-cache';
import { taskKeys, useTaskUpdateMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { findInCache } from '~/query/basic/find-in-list-cache';

/**
 * Returns `updateData(description, collaborative)` — the task-description persistence policy,
 * kept out of the editor component. Handles both modes:
 * - collaborative (Yjs): the relay owns backend persistence, so this only patches the caches
 *   optimistically (summary/counts) for the card views that render from cache, not the Y.Doc.
 * - non-collaborative: persists via the standard update mutation (offline queue, HLC, optimistic).
 */
export const useTaskDescriptionUpdate = (task: Task) => {
  const { mutateAsync: updateDesc } = useTaskUpdateMutation(task.tenantId, task.organizationId);

  return async (description: string, collaborative: boolean) => {
    if (collaborative) {
      // Cache-only optimistic derive; the relay materializes the session (≤3s) and SSE
      // delivers authoritative values moments later.
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
