import type { RefObject } from 'react';
import type { UserMinimalBase } from 'sdk';
import { type DropdownData, useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { SelectLabels } from '~/modules/task/dropdowns/select-labels';
import { SelectMembers } from '~/modules/task/dropdowns/select-members';
import { SelectPrimaryLabel } from '~/modules/task/dropdowns/select-primary-label';
import { SelectStatus } from '~/modules/task/dropdowns/select-status';
import type { TaskLabel, TaskStatusType } from '~/modules/task/types';

/** Props shared by every task-field dropdown, independent of which field is edited. */
type CommonDropdownProps = {
  triggerId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  triggerWidth?: number;
  /**
   * Optional id of the task being edited. When provided, the dropdown
   * subscribes to the task in the cache via `useTaskQuery` so remote SSE
   * updates reflect while it is open. Omit for the create-task form, where
   * no cached task exists yet.
   */
  taskId?: string;
};

/** Discriminated on `dropdownType` so each branch narrows without a cast. */
export type HandleDropdownProps = CommonDropdownProps &
  (
    | {
        dropdownType: 'labels';
        value: TaskLabel[];
        projectId: string;
        workspaceId?: string;
        onChange: (v: TaskLabel[]) => void;
      }
    | {
        dropdownType: 'assignedTo';
        value: UserMinimalBase[];
        projectId: string;
        onChange: (v: UserMinimalBase[]) => void;
      }
    | { dropdownType: 'status'; value: TaskStatusType; onChange: (v: TaskStatusType) => void }
    | { dropdownType: 'primaryLabel'; value: string; projectId: string; onChange: (v: string) => void }
  );

export function handleTaskDropdownClick(props: HandleDropdownProps) {
  const { dropdownType, triggerId, triggerRef, triggerWidth: width, taskId } = props;
  const options: DropdownData = {
    id: dropdownType,
    triggerRef,
    triggerId,
    align: dropdownType === 'status' || dropdownType === 'assignedTo' ? 'end' : 'start',
  };

  let component: React.ReactElement;

  if (props.dropdownType === 'labels') {
    component = (
      <SelectLabels
        value={props.value}
        projectId={props.projectId}
        workspaceId={props.workspaceId}
        onChange={props.onChange}
        taskId={taskId}
        triggerWidth={width}
      />
    );
  } else if (props.dropdownType === 'assignedTo') {
    component = (
      <SelectMembers
        value={props.value}
        projectId={props.projectId}
        onChange={props.onChange}
        taskId={taskId}
        triggerWidth={width}
      />
    );
  } else if (props.dropdownType === 'status') {
    component = <SelectStatus value={props.value} onChange={props.onChange} taskId={taskId} triggerWidth={width} />;
  } else {
    component = (
      <SelectPrimaryLabel value={props.value} projectId={props.projectId} onChange={props.onChange} taskId={taskId} />
    );
  }

  return useDropdowner.getState().create(component, options);
}
