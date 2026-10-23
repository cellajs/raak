import type { RefObject } from 'react';
import { type DropdownData, dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { SelectLabels } from '~/modules/task/dropdowns/select-labels';
import { SelectMembers } from '~/modules/task/dropdowns/select-members';
import { SelectPrimaryLabel } from '~/modules/task/dropdowns/select-primary-label';
import { SelectStatus } from '~/modules/task/dropdowns/select-status';
import type {
  SelectLabelsProps,
  SelectMembersProps,
  SelectPrimaryLabelProps,
  SelectStatusProps,
  TaskDropdownType,
} from '~/modules/task/dropdowns/types';
import type { buildFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import type { Task } from '~/modules/task/types';

interface TriggerProps {
  triggerId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

type TaskDropdownProps = TriggerProps &
  (
    | ({ dropdownType: 'labels' } & SelectLabelsProps)
    | ({ dropdownType: 'assignedTo' } & SelectMembersProps)
    | ({ dropdownType: 'status' } & SelectStatusProps)
    | ({ dropdownType: 'primaryLabel' } & SelectPrimaryLabelProps)
  );

const dropdownContent = (props: TaskDropdownProps) => {
  switch (props.dropdownType) {
    case 'labels':
      return (
        <SelectLabels
          value={props.value}
          projectId={props.projectId}
          onChange={props.onChange}
          taskId={props.taskId}
          triggerWidth={props.triggerWidth}
          initialSelectedCollapsed={props.initialSelectedCollapsed}
        />
      );
    case 'assignedTo':
      return (
        <SelectMembers
          value={props.value}
          projectId={props.projectId}
          onChange={props.onChange}
          taskId={props.taskId}
          triggerWidth={props.triggerWidth}
        />
      );
    case 'status':
      return <SelectStatus value={props.value} onChange={props.onChange} taskId={props.taskId} triggerWidth={props.triggerWidth} />;
    case 'primaryLabel':
      return <SelectPrimaryLabel value={props.value} projectId={props.projectId} onChange={props.onChange} taskId={props.taskId} />;
  }
};

export function openTaskDropdown(props: TaskDropdownProps) {
  const { dropdownType, triggerId, triggerRef } = props;
  const options: DropdownData = {
    id: dropdownType,
    triggerRef,
    triggerId,
    align: dropdownType === 'status' || dropdownType === 'assignedTo' ? 'end' : 'start',
  };

  return dropdowner.getState().create(dropdownContent(props), options);
}

/** Id of the button that opens a task's field dropdown; the hotkeys query it inside the task card. */
export const taskFieldTriggerId = (field: TaskDropdownType, taskId: string, isSheet: boolean) => `${field}-${taskId}${isSheet ? '-sheet' : ''}`;

/** Opens the dropdown for one field of a task, anchored to its trigger button. */
export function openTaskFieldDropdown(
  task: Task,
  field: TaskDropdownType,
  handlers: ReturnType<typeof buildFieldHandlers>,
  trigger: HTMLButtonElement,
  initialSelectedCollapsed?: boolean,
) {
  const base = { triggerId: trigger.id, triggerRef: { current: trigger }, taskId: task.id };
  const { projectId } = task;

  switch (field) {
    case 'labels':
      return openTaskDropdown({
        ...base,
        dropdownType: field,
        value: task.labels,
        projectId,
        onChange: handlers.onLabelsChange,
        initialSelectedCollapsed,
      });
    case 'assignedTo':
      return openTaskDropdown({ ...base, dropdownType: field, value: task.assignedTo, projectId, onChange: handlers.onAssignedToChange });
    case 'status':
      return openTaskDropdown({ ...base, dropdownType: field, value: task.status, onChange: handlers.onStatusChange });
    case 'primaryLabel':
      return openTaskDropdown({ ...base, dropdownType: field, value: task.primaryLabelId, projectId, onChange: handlers.onPrimaryLabelChange });
  }
}
