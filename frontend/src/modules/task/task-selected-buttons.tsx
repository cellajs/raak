import { CheckIcon, CircleDotDashedIcon, CopyIcon, TagIcon, TrashIcon, UserRoundPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { NamedText } from '~/modules/common/named-text';
import { SelectionActionBar } from '~/modules/common/selection-action-bar';
import { toaster } from '~/modules/common/toaster/toaster';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { DeleteTasks } from '~/modules/task/delete-tasks';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import { buildBulkFieldHandlers } from '~/modules/task/helpers/bulk-field-handlers';
import { copyTasksToClipboard } from '~/modules/task/helpers/copy-tasks';
import { openTaskDropdown } from '~/modules/task/helpers/open-task-dropdown';
import { useTaskUpdateMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';
import { Button } from '~/modules/ui/button';
import { useCurrentUser } from '~/modules/user/user-store';

interface TaskSelectedButtonsProps {
  selectedTaskIds: string[];
  clearSelection: () => void;
  organizationId: string;
  tenantId: string;
  /** Orders the resolved tasks; without it they keep the order of `selectedTaskIds`. */
  orderTasks?: (tasks: Task[]) => Task[];
}

type PickerType = 'status' | 'labels' | 'assignedTo';

/** Floating action bar for tasks selected on the board or table, all of one project: copy, set fields, delete + clear. */
export function TaskSelectedButtons({ selectedTaskIds, clearSelection, organizationId, tenantId, orderTasks }: TaskSelectedButtonsProps) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const taskMutation = useTaskUpdateMutation(tenantId, organizationId);
  const [copied, setCopied] = useState(false);

  // Resolve fresh entities from the query cache at action time; list queries overlap, so dedupe by id
  const resolveSelected = () => {
    const cached = new Map(cachedTasks().map((task) => [task.id, task]));
    const tasks = selectedTaskIds.flatMap((id) => cached.get(id) ?? []);
    return orderTasks?.(tasks) ?? tasks;
  };

  const handleCopy = async () => {
    const success = await copyTasksToClipboard(resolveSelected());
    if (!success) return toaster.error(t('c:copy_failed'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openPicker = (dropdownType: PickerType, currentTarget: HTMLButtonElement) => {
    const tasks = resolveSelected();
    const projectId = tasks[0]?.projectId;
    if (!projectId) return;

    const bulk = buildBulkFieldHandlers(tasks, { taskMutation, user });
    const base = { triggerId: `selected-tasks-${dropdownType}`, triggerRef: { current: currentTarget } };

    if (dropdownType === 'status') openTaskDropdown({ ...base, dropdownType, value: bulk.status, onChange: bulk.onStatusChange });
    else if (dropdownType === 'labels') openTaskDropdown({ ...base, dropdownType, projectId, ...bulk.labels });
    else openTaskDropdown({ ...base, dropdownType, projectId, ...bulk.assignedTo });
  };

  const resourceOf = (count: number) => (count > 1 ? t('c:task_other') : t('c:task')).toLowerCase();

  const openDeleteDialog = (currentTarget: HTMLButtonElement) => {
    const tasks = resolveSelected();
    if (!tasks.length) return;

    const { create, remove } = dialoger.getState();
    const removeDialog = () => remove('delete-tasks');
    const handleDeleted = () => {
      removeDialog();
      clearSelection();
    };

    create(<DeleteTasks tasks={tasks} callback={handleDeleted} onCancel={removeDialog} />, {
      id: 'delete-tasks',
      triggerRef: { current: currentTarget },
      className: 'max-w-xl',
      title: t('c:delete_resource', { resource: resourceOf(tasks.length) }),
      description: <NamedText i18nKey="c:confirm.delete_counted_resource" values={{ count: tasks.length, resource: resourceOf(tasks.length) }} />,
    });
  };

  const deleteLabel = t('c:delete_resource', { resource: resourceOf(selectedTaskIds.length) });

  const pickers = [
    { type: 'status', icon: CircleDotDashedIcon, label: t('c:set_resource', { resource: t('c:status').toLowerCase() }) },
    { type: 'labels', icon: TagIcon, label: t('c:set_resource', { resource: t('c:label_other').toLowerCase() }) },
    { type: 'assignedTo', icon: UserRoundPlusIcon, label: t('c:assign_to') },
  ] as const;

  return (
    <SelectionActionBar count={selectedTaskIds.length} onClear={clearSelection}>
      <TooltipButton toolTipContent={t('c:copy_content')} side="top">
        <Button variant="default" aria-label={t('c:copy_content')} onClick={handleCopy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className="max-sm:hidden">{t('c:copy')}</span>
        </Button>
      </TooltipButton>
      {pickers.map(({ type, icon: Icon, label }) => (
        <TooltipButton key={type} toolTipContent={label} side="top">
          <Button
            variant="plain"
            size="icon"
            aria-label={label}
            className="data-dropdowner-active:soft-bg-strong data-dropdowner-active:soft-border-medium"
            onClick={({ currentTarget }) => openPicker(type, currentTarget)}
          >
            <Icon />
          </Button>
        </TooltipButton>
      ))}
      <TooltipButton toolTipContent={deleteLabel} side="top">
        <Button variant="destructive" size="icon" aria-label={deleteLabel} onClick={({ currentTarget }) => openDeleteDialog(currentTarget)}>
          <TrashIcon />
        </Button>
      </TooltipButton>
    </SelectionActionBar>
  );
}
