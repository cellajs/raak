import { walkBlocks } from '~/modules/common/blocknote/helpers/blocknote-helpers';
import type { CustomBlock } from '~/modules/common/blocknote/types';
import type { TaskUpdateMutationFnVariables } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';

/**
 * Toggle a checklist checkbox in a serialised description (JSON string of blocks).
 * Returns the modified JSON string, or the original if the checkboxId wasn't found.
 */
function toggleCheckboxInDescription(description: string, checkboxId: string): string {
  try {
    const blocks = JSON.parse(description) as CustomBlock[];
    let found = false;
    walkBlocks(blocks, (block) => {
      if (block.type !== 'checklistItem' || block.props.checkboxId !== checkboxId) return;
      block.props.checked = !block.props.checked;
      found = true;
      return false;
    });
    return found ? JSON.stringify(blocks) : description;
  } catch {
    return description;
  }
}

/**
 * Toggle a checklist checkbox in a task's description.
 * Persists through the task update mutation pipeline so the toggle gets squashing,
 * the offline queue, and pending-mutation registration (SSE won't clobber it).
 * onMutate covers the optimistic cache writes, including derived checkbox counts
 * and the glow; the backend derives summary/counts server-side.
 * Stays in expanded state without editing mode.
 */
export function toggleTaskCheckbox(
  task: Task,
  checkboxId: string,
  mutate: (variables: TaskUpdateMutationFnVariables) => void,
) {
  if (!task.description) return;

  const toggled = toggleCheckboxInDescription(task.description, checkboxId);
  if (toggled === task.description) return;

  mutate({ id: task.id, ops: { description: toggled } });
}
