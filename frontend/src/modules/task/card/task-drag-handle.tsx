import { GripVerticalIcon } from 'lucide-react';
import { MotionConfig, motion } from 'motion/react';
import { type FocusEvent, type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getRelativeTaskOrder } from '~/modules/task/helpers/order-helpers';
import { usePanelTasks } from '~/modules/task/panel/panel-tasks-context';
import { useTaskUpdateMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';

// Both sizes, so it slides in above the type button or beside it
const folded = { width: 0, height: 0, opacity: 0 };
const unfolded = { width: 'auto', height: 'auto', opacity: 1 };

interface TaskDragHandleProps {
  task: Task;
  /** Folded away until it has focus: on a collapsed card the arrow keys move between cards until then. */
  revealOnFocus?: boolean;
  /** False mounts it in place, as when an open row scrolls back into view. */
  animateIn?: boolean;
}

/** Grip before the type button: unfolding, it pushes that button aside, and once focused the arrow keys step the card within its status. */
export function TaskDragHandle({ task, revealOnFocus = false, animateIn = true }: TaskDragHandleProps) {
  const { t } = useTranslation();
  const panelTasks = usePanelTasks();
  const { mutate: updateTask } = useTaskUpdateMutation(task.tenantId, task.organizationId);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const refocusAtOrder = useRef<number | null>(null);
  const [hasFocus, setHasFocus] = useState(false);

  const statusTasks = (panelTasks ?? []).filter((panelTask) => panelTask.status === task.status && !isDraftTask(panelTask));
  const index = statusTasks.findIndex((statusTask) => statusTask.id === task.id);

  const move = (step: -1 | 1) => {
    const target = statusTasks[index + step];
    if (!target) return;
    // Every task of the status, so the card lands right beside its visible neighbor even past tasks the search hides
    const allStatusTasks = cachedTasks().filter(
      (cached) => cached.projectId === task.projectId && cached.status === task.status && !isDraftTask(cached),
    );
    const displayOrder = getRelativeTaskOrder(step < 0 ? 'top' : 'bottom', allStatusTasks, target.displayOrder, task.id);
    if (displayOrder === task.displayOrder) return;
    refocusAtOrder.current = displayOrder;
    updateTask({ id: task.id, ops: { displayOrder } });
  };

  // React re-inserts a row it moves down, and a removed node drops focus
  useLayoutEffect(() => {
    if (refocusAtOrder.current === null || refocusAtOrder.current !== task.displayOrder) return;
    refocusAtOrder.current = null;
    buttonRef.current?.focus();
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    move(event.key === 'ArrowUp' ? -1 : 1);
  };

  // The blur of a re-inserted row has no next target: the grip stays unfolded through the move
  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    if (!event.relatedTarget && refocusAtOrder.current !== null) return;
    setHasFocus(false);
  };

  if (index === -1) return null;

  return (
    <MotionConfig reducedMotion="user">
      {/* overflow-clip is no scroll container, so focusing the folded button does not scroll it */}
      <motion.div
        className="-ml-0.5 shrink-0 overflow-clip"
        initial={animateIn ? folded : false}
        animate={!revealOnFocus || hasFocus ? unfolded : folded}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <Button
          ref={buttonRef}
          variant="ghost"
          size="xs"
          aria-roledescription={t('c:sortable')}
          aria-label={t('c:sortable_position', { name: task.name, position: index + 1, total: statusTasks.length })}
          onKeyDown={handleKeyDown}
          onFocus={() => setHasFocus(true)}
          onBlur={handleBlur}
          // Only a collapsed card is draggable, so an open one shows no grab cursor
          className="focus-inset h-8 w-8 group-data-[state=collapsed]/task:cursor-grab group-data-[state=collapsed]/task:active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-3.5" />
        </Button>
      </motion.div>
    </MotionConfig>
  );
}
