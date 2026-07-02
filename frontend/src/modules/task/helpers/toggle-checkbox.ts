// biome-ignore lint/style/noRestrictedImports: imperative cache-coupled helper invoked from BlockNote checkbox callback — not a render-phase call.
import { updateTask } from 'sdk';
import { deriveDescriptionCounts } from '~/modules/task/helpers/derive-description-props';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { taskKeys } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { cacheUpdate } from '~/query/basic/cache-mutations';
import type { ItemData } from '~/query/basic/types';
import { createStxForUpdate } from '~/query/offline';
import { queryClient } from '~/query/query-client';

// biome-ignore lint/suspicious/noExplicitAny: block structure is dynamic
type Block = { type: string; props: Record<string, any>; children?: Block[] };

/**
 * Toggle a checklist checkbox in a serialised description (JSON string of blocks).
 * Returns the modified JSON string, or the original if the checkboxId wasn't found.
 */
function toggleCheckboxInDescription(description: string, checkboxId: string): string {
  try {
    const blocks: Block[] = JSON.parse(description);
    if (!toggleInBlocks(blocks, checkboxId)) return description;
    return JSON.stringify(blocks);
  } catch {
    return description;
  }
}

function toggleInBlocks(blocks: Block[], checkboxId: string): boolean {
  for (const block of blocks) {
    if (block.type === 'checklistItem' && block.props.checkboxId === checkboxId) {
      block.props.checked = !block.props.checked;
      return true;
    }
    if (block.children?.length && toggleInBlocks(block.children, checkboxId)) return true;
  }
  return false;
}

/**
 * Toggle a checklist checkbox in a task's description.
 * Updates both caches synchronously and persists to backend.
 * Stays in expanded state — no editing mode needed.
 */
export async function toggleTaskCheckbox(task: Task, checkboxId: string) {
  if (!task.description) return;

  const toggled = toggleCheckboxInDescription(task.description, checkboxId);
  if (toggled === task.description) return;

  const now = new Date().toISOString();
  // Derive checkbox counts optimistically (synchronous)
  const counts = deriveDescriptionCounts(toggled);

  const optimistic = { ...task, description: toggled, ...counts, updatedAt: now };

  // Update detail cache
  queryClient.setQueryData<Task>(taskKeys.detail.byId(task.id), (old) => (old ? { ...old, ...optimistic } : undefined));

  // Update list cache
  const orgKey = taskKeys.list.org(task.organizationId);
  cacheUpdate(orgKey, [optimistic as ItemData]);

  // Visual feedback
  triggerTaskGlow(task.id);

  // Persist to backend (backend derives summary/counts server-side)
  const stx = createStxForUpdate(['description']);
  await updateTask({
    body: { ops: { description: toggled }, stx },
    path: { id: task.id, organizationId: task.organizationId, tenantId: task.tenantId },
  });
}
