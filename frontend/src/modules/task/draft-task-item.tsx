import { memo, useEffect, useRef } from 'react';
import type { Project } from 'sdk';
import { CreateTaskForm } from '~/modules/task/create-task-form';
import { markCurrentItemMounted } from '~/modules/task/helpers/focus-task';
import { useItemControlsTabOrder } from '~/modules/task/hooks/use-item-controls-tab-order';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { TaskStatus } from '~/modules/task/task-properties';
import type { TaskProps } from '~/modules/task/types';

/**
 * Memo'd wrapper for draft tasks with a focusedTaskId boolean selector.
 */
export const DraftTaskItem = memo(function DraftTaskItem({
  task,
  project,
  onStatusChange,
}: {
  task: TaskProps['task'];
  project: Project;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const isFocused = useTaskInteractionStore((s) => s.focusedTaskId === task.id);
  const itemRef = useRef<HTMLDivElement>(null);
  useItemControlsTabOrder(itemRef, task.id, isFocused);
  useEffect(() => (isFocused ? markCurrentItemMounted(task.id) : undefined), [isFocused, task.id]);

  return (
    <div ref={itemRef}>
      <CreateTaskForm projectId={project.id} organizationId={project.organizationId} className="max-sm:p-4" onStatusChange={onStatusChange} />
    </div>
  );
});
