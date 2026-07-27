import { TrashIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SelectionActionBar } from '~/modules/common/selection-action-bar';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import { useTaskDeleteMutation } from '~/modules/task/query';
import { Button } from '~/modules/ui/button';

interface TaskSelectedButtonsProps {
  selectedTaskIds: string[];
  clearSelection: () => void;
  organizationId: string;
  tenantId: string;
}

/** Floating action bar for tasks selected on the board or table: remove + clear. */
export const TaskSelectedButtons = ({
  selectedTaskIds,
  clearSelection,
  organizationId,
  tenantId,
}: TaskSelectedButtonsProps) => {
  const { t } = useTranslation();
  const { mutateAsync: tasksDeleteMutation } = useTaskDeleteMutation(tenantId, organizationId);

  const onRemove = async () => {
    // Resolve fresh entities from the query cache at action time; list queries overlap, so dedupe by id
    const idSet = new Set(selectedTaskIds);
    const tasksToDelete = [
      ...new Map(cachedTasks().flatMap((task) => (idSet.has(task.id) ? [[task.id, task] as const] : []))).values(),
    ];
    // Backend handles label counter side-effects (usedCount decrement + auto-delete) atomically
    await tasksDeleteMutation({ tasksToDelete });
    clearSelection();
  };

  return (
    <SelectionActionBar count={selectedTaskIds.length} onClear={clearSelection}>
      <TooltipButton toolTipContent={t('c:remove_task')} side="top">
        <Button variant="destructive" onClick={onRemove}>
          <TrashIcon />
          <span className="ml-1">{t('c:remove')}</span>
        </Button>
      </TooltipButton>
    </SelectionActionBar>
  );
};
