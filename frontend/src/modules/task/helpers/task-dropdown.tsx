import type { RefObject } from 'react';
import type { UserMinimalBase } from 'sdk';
import { type DropdownData, useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { SelectLabels } from '~/modules/task/dropdowns/select-labels';
import { SelectMembers } from '~/modules/task/dropdowns/select-members';
import { SelectPoints } from '~/modules/task/dropdowns/select-points';
import { SelectStatus } from '~/modules/task/dropdowns/select-status';
import { SelectVariant } from '~/modules/task/dropdowns/select-variant';
import type { DropdownsType } from '~/modules/task/dropdowns/types';
import type { TaskLabel, TaskPointsType, TaskStatusType, TaskVariantType } from '~/modules/task/types';

type DropdownFieldMap = {
  points: { value: TaskPointsType | null; onChange: (v: TaskPointsType) => void };
  labels: {
    value: TaskLabel[];
    projectId: string;
    workspaceId?: string;
    onChange: (v: TaskLabel[]) => void;
  };
  assignedTo: { value: UserMinimalBase[]; projectId: string; onChange: (v: UserMinimalBase[]) => void };
  status: { value: TaskStatusType; onChange: (v: TaskStatusType) => void };
  variant: { value: TaskVariantType; onChange: (v: TaskVariantType) => void };
};

type HandleDropdownProps<T extends DropdownsType> = DropdownFieldMap[T] & {
  dropdownType: T;
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

export function handleTaskDropdownClick<T extends DropdownsType>(props: HandleDropdownProps<T>) {
  const { dropdownType, triggerId, triggerRef, triggerWidth, taskId } = props;
  const options: DropdownData = {
    id: dropdownType,
    triggerRef,
    triggerId,
    align: dropdownType === 'status' || dropdownType === 'assignedTo' ? 'end' : 'start',
  };

  const width = triggerWidth;
  let component: React.ReactElement;

  if (dropdownType === 'points') {
    const { value, onChange } = props as HandleDropdownProps<'points'>;
    component = <SelectPoints value={value} onChange={onChange} taskId={taskId} triggerWidth={width} />;
  } else if (dropdownType === 'labels') {
    const { value, projectId, workspaceId, onChange } = props as HandleDropdownProps<'labels'>;
    component = (
      <SelectLabels
        value={value}
        projectId={projectId}
        workspaceId={workspaceId}
        onChange={onChange}
        taskId={taskId}
        triggerWidth={width}
      />
    );
  } else if (dropdownType === 'assignedTo') {
    const { value, projectId, onChange } = props as HandleDropdownProps<'assignedTo'>;
    component = (
      <SelectMembers value={value} projectId={projectId} onChange={onChange} taskId={taskId} triggerWidth={width} />
    );
  } else if (dropdownType === 'status') {
    const { value, onChange } = props as HandleDropdownProps<'status'>;
    component = <SelectStatus value={value} onChange={onChange} taskId={taskId} triggerWidth={width} />;
  } else {
    const { value, onChange } = props as HandleDropdownProps<'variant'>;
    component = <SelectVariant value={value} onChange={onChange} taskId={taskId} />;
  }

  return useDropdowner.getState().create(component, options);
}
