import { patchCollaborativeDescription, persistStandaloneDescription } from '~/modules/common/blocknote/description-updater';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { useTaskUpdateMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';

/** Collaborative edits patch the caches while Yjs persists; without Yjs, edits go through the update mutation. */
export const useTaskDescriptionUpdate = (task: Task) => {
  const { mutateAsync: updateTask } = useTaskUpdateMutation(task.tenantId, task.organizationId);

  return async (description: string, collaborative: boolean) => {
    if (collaborative) {
      // Leaving a collaborative editor commits even when nothing was edited
      if (description === task.description) return;

      patchCollaborativeDescription('task', task, description);
      // The collaborative path skips the mutation that glows via query.ts; triggerTaskGlow waits until the card leaves editing
      triggerTaskGlow(task.id);
      return;
    }

    await persistStandaloneDescription('task', task, description, (ops) => updateTask({ id: task.id, ops }));
  };
};
