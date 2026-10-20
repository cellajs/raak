import { type FocusEvent, type ReactNode, type RefObject, useMemo } from 'react';
import { setTaskCardFocus } from '~/modules/task/helpers/focus-task';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { TaskProps } from '~/modules/task/types';
import { cn } from '~/utils/cn';

interface TaskListFocusScopeProps {
  id: string;
  className?: string;
  tasks: TaskProps['task'][];
  /** The panel's scroll viewport; absent while the window scrolls. */
  viewportRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

const firstItemInView = (tasks: TaskProps['task'][], viewport: HTMLElement | null) => {
  const top = viewport?.getBoundingClientRect().top ?? 0;
  for (const { id } of tasks) {
    const item = document.getElementById(id);
    if (item && item.getBoundingClientRect().bottom > top + 1) return id;
  }
  return tasks[0]?.id;
};

/**
 * A panel's task list as one Tab stop. A mounted current item (task card or create form) holds it; otherwise the list
 * does, and passes focus straight on to its current item, or else to the first item in view, making that one current.
 */
export function TaskListFocusScope({ id, className, tasks, viewportRef, children }: TaskListFocusScopeProps) {
  const taskIds = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks]);
  const itemHoldsStop = useTaskInteractionStore((s) => !!s.mountedFocusId && s.mountedFocusId === s.focusedTaskId && taskIds.has(s.mountedFocusId));

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const { focusedTaskId } = useTaskInteractionStore.getState();
    const targetId = focusedTaskId && taskIds.has(focusedTaskId) ? focusedTaskId : firstItemInView(tasks, viewportRef.current);
    if (targetId) setTaskCardFocus(targetId);
  };

  return (
    <div id={id} className={cn('outline-none', className)} tabIndex={itemHoldsStop ? -1 : 0} onFocus={handleFocus}>
      {children}
    </div>
  );
}
