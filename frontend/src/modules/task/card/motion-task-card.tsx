import { motion } from 'motion/react';
import { memo } from 'react';
import { TaskCard } from '~/modules/task/card/task-card';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { TaskProps } from '~/modules/task/types';

/**
 * Memoized wrapper for motion.div + TaskCard.
 * Prevents motion.div from rerendering when the panel rerenders
 * but individual task props haven't changed.
 */
export const MotionTaskCard = memo(function MotionTaskCard({ task }: { task: TaskProps['task'] }) {
  const state = useTaskCardStore((s) => s.states[task.id] ?? 'collapsed');
  const isSelected = useTaskInteractionStore(
    (s) => s.selectedTasks.length > 0 && s.selectedTasks.some(({ id }) => id === task.id),
  );
  const isFocused = useTaskInteractionStore((s) => s.focusedTaskId === task.id);

  return (
    <motion.div layout={state === 'editing' ? false : 'position'} transition={{ duration: 0.3 }}>
      <TaskCard task={task} state={state} isSelected={isSelected} isFocused={isFocused} />
    </motion.div>
  );
});
