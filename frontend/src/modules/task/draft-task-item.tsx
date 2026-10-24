import { memo, useEffect, useRef } from 'react';
import type { Project } from 'sdk';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { CreateTaskForm } from '~/modules/task/create-task-form';
import { markCurrentItemMounted } from '~/modules/task/helpers/focus-item';
import { useItemControlsTabOrder } from '~/modules/task/hooks/use-item-controls-tab-order';
import type { TaskStatus } from '~/modules/task/task-properties';
import type { TaskProps } from '~/modules/task/types';

interface DraftTaskItemProps {
  task: TaskProps['task'];
  project: Project;
  onStatusChange: (status: TaskStatus) => void;
}

export const DraftTaskItem = memo(function DraftTaskItem({ task, project, onStatusChange }: DraftTaskItemProps) {
  const isFocused = useBoardFocusStore((state) => state.currentItemId === task.id);
  const itemRef = useRef<HTMLDivElement>(null);
  useItemControlsTabOrder(itemRef, task.id, isFocused);
  useEffect(() => (isFocused ? markCurrentItemMounted(task.id) : undefined), [isFocused, task.id]);

  return (
    <div ref={itemRef}>
      <CreateTaskForm projectId={project.id} organizationId={project.organizationId} className="max-sm:p-4" onStatusChange={onStatusChange} />
    </div>
  );
});
