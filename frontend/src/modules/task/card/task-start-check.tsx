import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { cn } from '~/utils/cn';

const checkDuration = 1600;

const useStartChecks = create<{ checks: Record<string, number> }>(() => ({ checks: {} }));

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Shows "Copied" on a task's status button. Kept in a store: Start re-sorts the list, which can remount the card mid-check. */
export const showStartCheck = (taskId: string) => {
  clearTimeout(timers.get(taskId));
  useStartChecks.setState(({ checks }) => ({ checks: { ...checks, [taskId]: (checks[taskId] ?? 0) + 1 } }));
  timers.set(
    taskId,
    setTimeout(() => {
      timers.delete(taskId);
      useStartChecks.setState(({ checks: { [taskId]: _, ...rest } }) => ({ checks: rest }));
    }, checkDuration),
  );
};

interface TaskStartCheckProps {
  taskId: string;
  className?: string;
}

/** Says Start copied the task, over the whole status control. Too narrow without a chevron, it grows left over its neighbour: nothing shifts. */
export function TaskStartCheck({ taskId, className }: TaskStartCheckProps) {
  const { t } = useTranslation();
  const check = useStartChecks((state) => state.checks[taskId]);
  if (!check) return null;

  return (
    <motion.span
      key={check}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: checkDuration / 1000, times: [0, 0.1, 0.85, 1], ease: 'easeOut' }}
      className={cn(
        'pointer-events-none absolute inset-y-0 right-0 z-10 flex w-max min-w-full items-center justify-center gap-1 rounded-md border border-success/80 bg-[color-mix(in_oklab,var(--success)_10%,var(--background))] px-1.5 font-medium text-sm text-success',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5 shrink-0"
      >
        <motion.path
          d="M20 6 9 17l-5-5"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.1, duration: 0.25, ease: 'easeOut' }}
        />
      </svg>
      {t('c:copied')}
    </motion.span>
  );
}
