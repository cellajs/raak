import { deriveDescriptionProps } from '~/modules/common/blocknote/derive-description-props';
import {
  patchCollaborativeDescription,
  persistStandaloneDescription,
} from '~/modules/common/blocknote/use-description-update';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { useTaskUpdateMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';

/**
 * Returns the task-description update policy.
 * Collaborative edits patch caches while Yjs persists; other edits use the update mutation.
 */
export const useTaskDescriptionUpdate = (task: Task) => {
  const { mutateAsync: updateDesc } = useTaskUpdateMutation(task.tenantId, task.organizationId);

  return async (description: string, collaborative: boolean) => {
    // attachmentCount is presentation-only (task.attachments is the derived id list), keep it off the cached row.
    const {
      attachmentCount: _attachmentCount,
      summary,
      summaryLength,
      ...derived
    } = await deriveDescriptionProps(description);

    if (collaborative) {
      patchCollaborativeDescription('task', task, description, { summary, summaryLength, ...derived });
      // Match label/status edits: the standard mutation glows via query.ts, but the collaborative
      // path patches caches directly. triggerTaskGlow defers itself until the card leaves editing.
      triggerTaskGlow(task.id);
      return;
    }

    await persistStandaloneDescription('task', task, description, (ops) =>
      updateDesc({ id: task.id, ops, summary, summaryLength }),
    );
  };
};
