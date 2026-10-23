import type { RefObject } from 'react';
import { type DropdownData, dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { SelectLabels } from '~/modules/task/dropdowns/select-labels';
import { SelectMembers } from '~/modules/task/dropdowns/select-members';
import { SelectPrimaryLabel } from '~/modules/task/dropdowns/select-primary-label';
import { SelectStatus } from '~/modules/task/dropdowns/select-status';
import type { SelectLabelsProps, SelectMembersProps, SelectPrimaryLabelProps, SelectStatusProps } from '~/modules/task/dropdowns/types';

interface TriggerProps {
  triggerId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
}

/** Discriminated on `dropdownType` so each branch narrows without a cast. */
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

export function handleTaskDropdownClick(props: TaskDropdownProps) {
  const { dropdownType, triggerId, triggerRef } = props;
  const options: DropdownData = {
    id: dropdownType,
    triggerRef,
    triggerId,
    align: dropdownType === 'status' || dropdownType === 'assignedTo' ? 'end' : 'start',
  };

  return dropdowner.getState().create(dropdownContent(props), options);
}
