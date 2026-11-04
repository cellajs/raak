import { CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { create } from 'zustand';
import { Tooltip, TooltipContent } from '~/modules/ui/tooltip';
import { cn } from '~/utils/cn';

const checkDuration = 1600;
const closeDuration = 200; // the tooltip's fade-out, before it unmounts

/** Per task: true while "Copied" shows, false while it fades. */
const useStartChecks = create<{ checks: Record<string, boolean> }>(() => ({ checks: {} }));

const timers = new Map<string, ReturnType<typeof setTimeout>>();

const setCheck = (taskId: string, open: boolean) => useStartChecks.setState(({ checks }) => ({ checks: { ...checks, [taskId]: open } }));

/** Shows "Copied" on a task's status button. Kept in a store: Start re-sorts the list, which can remount the card mid-check. */
export const showStartCheck = (taskId: string) => {
  clearTimeout(timers.get(taskId));
  setCheck(taskId, true);
  timers.set(
    taskId,
    setTimeout(() => {
      setCheck(taskId, false);
      timers.set(
        taskId,
        setTimeout(() => {
          timers.delete(taskId);
          useStartChecks.setState(({ checks: { [taskId]: _, ...rest } }) => ({ checks: rest }));
        }, closeDuration),
      );
    }, checkDuration),
  );
};

interface TaskStartCheckProps {
  taskId: string;
  className?: string;
}

/** Says Start copied the task, in a tooltip over the status control it sits in. */
export function TaskStartCheck({ taskId, className }: TaskStartCheckProps) {
  const { t } = useTranslation();
  const check = useStartChecks((state) => state.checks[taskId]);
  const [anchor, setAnchor] = useState<HTMLSpanElement | null>(null);
  if (check === undefined) return null;

  return (
    <>
      <span ref={setAnchor} aria-hidden="true" className={cn('pointer-events-none absolute inset-y-0 right-0 left-0', className)} />
      <Tooltip open={check && !!anchor}>
        {/* Unlike a hover tooltip it shows on a phone too: Start is a tap there */}
        <TooltipContent anchor={anchor} side="top" sideOffset={8} className="flex items-center gap-1.5 max-sm:flex">
          <CheckIcon aria-hidden="true" className="size-3.5 text-green-400 dark:text-green-800" strokeWidth={3} />
          {t('c:copied')}
        </TooltipContent>
      </Tooltip>
    </>
  );
}
