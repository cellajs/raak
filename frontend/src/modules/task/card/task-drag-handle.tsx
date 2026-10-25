import { GripVerticalIcon } from 'lucide-react';
import { type FocusEvent, useLayoutEffect, useRef, useState } from 'react';
import { ReorderHandle } from '~/modules/common/reorder-handle/reorder-handle';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getRelativeTaskOrder } from '~/modules/task/helpers/order-helpers';
import { usePanelTasks } from '~/modules/task/panel/panel-tasks-context';
import { useTaskUpdateMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { buttonVariants } from '~/modules/ui/button';
import { cn } from '~/utils/cn';
import { tw } from '~/utils/tw';

// Grid fr tracks animate both sizes, so it slides in above the type button or beside it. Folded beside it on a phone,
// a margin would still pull the type button left.
const foldClass = tw(
  'grid shrink-0 grid-cols-[0fr] grid-rows-[0fr] opacity-0 transition-[grid-template-columns,grid-template-rows,opacity] duration-200 ease-out data-open:-ml-0.5 data-open:grid-cols-[1fr] data-open:grid-rows-[1fr] data-open:opacity-100 motion-reduce:transition-none',
);

interface TaskDragHandleProps {
  task: Task;
}

/** Grip of an open card, folded away until focused so only a keyboard reaches it; its arrow keys step the card within its status. */
export function TaskDragHandle({ task }: TaskDragHandleProps) {
  const panelTasks = usePanelTasks();
  const { mutate: updateTask } = useTaskUpdateMutation(task.tenantId, task.organizationId);

  const pendingOrderRef = useRef<number | null>(null);
  const [hasFocus, setHasFocus] = useState(false);

  const statusTasks = (panelTasks ?? []).filter((panelTask) => panelTask.status === task.status && !isDraftTask(panelTask));
  const index = statusTasks.findIndex((statusTask) => statusTask.id === task.id);

  const move = (step: -1 | 1) => {
    const target = statusTasks[index + step];
    if (!target) return;
    // Every task of the status, so the card moves right beside its visible neighbor even past tasks the search hides
    const allStatusTasks = cachedTasks().filter(
      (cached) => cached.projectId === task.projectId && cached.status === task.status && !isDraftTask(cached),
    );
    const displayOrder = getRelativeTaskOrder(step < 0 ? 'top' : 'bottom', allStatusTasks, target.displayOrder, task.id);
    if (displayOrder === task.displayOrder) return;
    pendingOrderRef.current = displayOrder;
    updateTask({ id: task.id, ops: { displayOrder } });
  };

  // Runs after the handle's own effect has focused it again in its new place
  useLayoutEffect(() => {
    if (pendingOrderRef.current === task.displayOrder) pendingOrderRef.current = null;
  });

  // The blur of a re-inserted row has no next target: the grip stays unfolded through the move
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.relatedTarget && pendingOrderRef.current !== null) return;
    setHasFocus(false);
  };

  if (index === -1) return null;

  return (
    <div data-open={hasFocus || undefined} className={foldClass} onFocus={() => setHasFocus(true)} onBlur={handleBlur}>
      {/* overflow-clip is no scroll container, so focusing the folded button does not scroll it */}
      <div className="min-h-0 min-w-0 overflow-clip">
        <ReorderHandle
          id={task.id}
          name={task.name}
          index={index}
          total={statusTasks.length}
          onMove={move}
          className={cn(buttonVariants({ variant: 'ghost', size: 'xs' }), 'focus-inset size-8')}
        >
          <GripVerticalIcon className="size-3.5" />
        </ReorderHandle>
      </div>
    </div>
  );
}
