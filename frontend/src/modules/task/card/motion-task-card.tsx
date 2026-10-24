import { motion } from 'motion/react';
import { memo } from 'react';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { TaskCard } from '~/modules/task/card/task-card';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { TaskProps } from '~/modules/task/types';

interface MotionTaskCardProps {
  task: TaskProps['task'];
}

/** Prevents motion.div from rerendering when the panel rerenders but individual task props haven't changed. */
export const MotionTaskCard = memo(function MotionTaskCard({ task }: MotionTaskCardProps) {
  const state = useTaskCardStore((state) => state.states[task.id] ?? 'collapsed');
  const isSelected = useTaskInteractionStore((state) => state.selectedTaskIds.includes(task.id));
  const isFocused = useBoardFocusStore((state) => state.currentItemId === task.id);

  return (
    <motion.div layout={state === 'editing' ? false : 'position'} transition={{ duration: 0.3 }}>
      <TaskCard task={task} state={state} isSelected={isSelected} isFocused={isFocused} />
    </motion.div>
  );
});
