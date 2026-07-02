import { memo } from 'react';
import type { Project } from 'sdk';
import { FocusTrap } from '~/modules/common/focus-trap';
import CreateTaskForm from '~/modules/task/create-task-form';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { TaskStatus } from '~/modules/task/task-properties';
import type { TaskProps } from '~/modules/task/types';

/**
 * Memo'd wrapper for draft (create-form) tasks — owns the focusedTaskId subscription via boolean selector.
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
  return (
    <FocusTrap key={task.id} mainElementId={task.id} active={isFocused}>
      <CreateTaskForm
        projectId={project.id}
        organizationId={project.organizationId}
        className="max-sm:p-4"
        onStatusChange={onStatusChange}
      />
    </FocusTrap>
  );
});
