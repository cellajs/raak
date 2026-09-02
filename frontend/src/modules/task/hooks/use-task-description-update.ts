import { deriveDescriptionProps } from '~/modules/common/blocknote/derive-description-props';
import { patchDescriptionCaches } from '~/modules/common/blocknote/description-cache';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
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
      // attachmentCount is presentation-only (task.attachments is the derived id list), keep it off the cached row.
      const { attachmentCount: _attachmentCount, ...derived } = await deriveDescriptionProps(description);
      patchDescriptionCaches(
        'task',
        task.id,
        { detailKey: taskKeys.detail.byId(task.id), listKey: taskKeys.list.org(task.organizationId) },
        { description, ...derived, updatedAt: new Date().toISOString() },
      );
      // Match label/status edits: the standard mutation glows via query.ts, but the collaborative
      // path patches caches directly. triggerTaskGlow defers itself until the card leaves editing.
      triggerTaskGlow(task.id);
      return;
    }

    // Non-collab: persist via the standard mutation (offline queue, HLC, optimistic cache).
    // Skip if the task was deleted (e.g. unmount flush after deletion).
    if (!findInCache<Task>('task', task.id)) return;
    const { summary, summaryLength } = await deriveDescriptionProps(description);
    await updateDesc({ id: task.id, ops: { description }, summary, summaryLength });
  };
};
