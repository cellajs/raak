import { deriveDescriptionProps } from '~/modules/task/helpers/derive-description-props';
import { taskKeys, useTaskUpdateMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { cacheUpdate } from '~/query/basic/cache-mutations';
import { findInCache } from '~/query/basic/find-in-list-cache';
import type { ItemData } from '~/query/basic/types';
import { queryClient } from '~/query/query-client';

/**
 * Returns `updateData(description)` — the task-description persistence policy, kept out of the
 * editor component. Handles both modes:
 * - collaborative (Yjs): the relay owns backend persistence, so this only patches the caches
 *   optimistically (summary/counts) for the card views that render from cache, not the Y.Doc.
 * - non-collaborative: persists via the standard update mutation (offline queue, HLC, optimistic).
 */
export const useTaskDescriptionUpdate = (task: Task, collaborative: boolean) => {
  const { mutateAsync: updateDesc } = useTaskUpdateMutation(task.tenantId, task.organizationId);
  const orgKey = taskKeys.list.org(task.organizationId);

  return async (description: string) => {
    if (collaborative) {
      // The Yjs relay owns backend persistence in collab mode (it materializes the
      // session ≤3s after edits) — no mutation fires on blur. Sync the caches with a
      // cache-only optimistic derive so collapsed/expanded card views (which render
      // from the query cache, not the Y.Doc) show fresh summary/counts instantly;
      // the relay's materialization arrives via SSE moments later with authoritative values.
      const derived = await deriveDescriptionProps(description);
      const patch = { description, ...derived, updatedAt: new Date().toISOString() };
      queryClient.setQueryData<Task>(taskKeys.detail.byId(task.id), (old) => (old ? { ...old, ...patch } : undefined));
      const cached = findInCache<Task>('task', task.id);
      if (cached) cacheUpdate(orgKey, [{ ...cached, ...patch } as ItemData]);
      return;
    }

    // Non-collab: persist via the standard mutation (offline queue, HLC, optimistic cache).
    // Skip if the task was deleted (e.g. unmount flush after deletion).
    if (!findInCache<Task>('task', task.id)) return;
    const { summary, summaryLength } = await deriveDescriptionProps(description);
    await updateDesc({ id: task.id, ops: { description }, summary, summaryLength });
  };
};
