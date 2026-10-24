import { GripVerticalIcon } from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
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

// Both sizes, so it slides in above the type button or beside it
const folded = { width: 0, height: 0, opacity: 0 };
const unfolded = { width: 'auto', height: 'auto', opacity: 1 };

interface TaskDragHandleProps {
  task: Task;
}

/** Grip before the type button, folded away until focused so only a keyboard reaches it; its arrow keys step the card within its status. */
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
    <MotionConfig reducedMotion="user">
      {/* overflow-clip is no scroll container, so focusing the folded button does not scroll it */}
      <motion.div
        className="-ml-0.5 shrink-0 overflow-clip"
        initial={false}
        animate={hasFocus ? unfolded : folded}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onFocus={() => setHasFocus(true)}
        onBlur={handleBlur}
      >
        <ReorderHandle
          id={task.id}
          name={task.name}
          index={index}
          total={statusTasks.length}
          onMove={move}
          // Only a collapsed card is draggable, so an open one shows no grab cursor
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'xs' }),
            'focus-inset size-8 group-data-[state=collapsed]/task:cursor-grab group-data-[state=collapsed]/task:active:cursor-grabbing',
          )}
        >
          <GripVerticalIcon className="size-3.5" />
        </ReorderHandle>
      </motion.div>
    </MotionConfig>
  );
}
