import type { UserMinimalBase } from 'sdk';
import type { TaskLabel, TaskPointsType, TaskStatusType, TaskVariantType } from '~/modules/task/types';

export type DropdownsType = 'points' | 'labels' | 'assignedTo' | 'status' | 'variant';

/** Shared layout props for all task dropdowns */
type DropdownLayoutProps = {
  triggerWidth?: number;
  /**
   * Optional id of the task this dropdown is editing. When present, the
   * dropdown subscribes to the task in the cache and reflects live updates
   * (e.g. from SSE) while open. Omit for create-task forms.
   */
  taskId?: string;
};

/** Value/onChange props per dropdown type — no Task dependency */
export type SelectPointsProps = DropdownLayoutProps & {
  value: TaskPointsType | null;
  onChange: (newValue: TaskPointsType) => void;
};

export type SelectLabelsProps = DropdownLayoutProps & {
  value: TaskLabel[];
  projectId: string;
  workspaceId?: string;
  onChange: (labels: TaskLabel[]) => void;
};

export type SelectMembersProps = DropdownLayoutProps & {
  value: UserMinimalBase[];
  projectId: string;
  onChange: (users: UserMinimalBase[]) => void;
};

export type SelectStatusProps = DropdownLayoutProps & {
  value: TaskStatusType;
  onChange: (newValue: TaskStatusType) => void;
};

export type SelectVariantProps = DropdownLayoutProps & {
  value: TaskVariantType;
  onChange: (newValue: TaskVariantType) => void;
  className?: string;
};
