import { TrashIcon, XSquareIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { useTaskDeleteMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { Badge } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';

interface TaskSelectedButtonsProps {
  selectedTasks: Task[];
  clearSelection: () => void;
  organizationId: string;
  tenantId: string;
}

export const TaskSelectedButtons = ({
  selectedTasks,
  clearSelection,
  organizationId,
  tenantId,
}: TaskSelectedButtonsProps) => {
  const { t } = useTranslation();
  const { mutateAsync: tasksDeleteMutation } = useTaskDeleteMutation(tenantId, organizationId);

  // Return null if no tasks are selected
  if (!selectedTasks.length) return null;

  const onRemove = async () => {
    // Backend handles label counter side-effects (usedCount decrement + auto-delete) atomically
    await tasksDeleteMutation({ tasksToDelete: selectedTasks });
    clearSelection();
  };

  return (
    <div className="inline-flex items-center gap-2 align-center">
      <TooltipButton toolTipContent={t('c:remove_task')}>
        <Button variant="destructive" className="relative" onClick={onRemove}>
          <Badge className="absolute -top-1.5 -right-2 flex min-w-5 justify-center px-1 py-0 shadow-sm">
            {selectedTasks.length}
          </Badge>
          <TrashIcon size={16} />
          <span className="ml-1 max-md:hidden">{t('c:remove')}</span>
        </Button>
      </TooltipButton>

      <TooltipButton toolTipContent={t('c:clear_selection')}>
        <Button variant="ghost" className="relative" onClick={clearSelection}>
          <XSquareIcon size={16} />
          <span className="ml-1 max-lg:hidden">{t('c:clear')}</span>
        </Button>
      </TooltipButton>
    </div>
  );
};
