import type { UserMinimalBase } from 'sdk';
import type { TaskLabel, TaskStatusType } from '~/modules/task/types';

export type DropdownsType = 'labels' | 'assignedTo' | 'status' | 'primaryLabel';

/**
 * Optional id of the task this dropdown is editing. When present, the dropdown
 * subscribes to the task in the cache and reflects live updates (e.g. from SSE)
 * while open. Omit for create-task forms.
 */
type TaskSubscriptionProps = { taskId?: string };

/** Layout props for the CSS-var-width dropdowns (labels/members/status). */
type DropdownLayoutProps = TaskSubscriptionProps & { triggerWidth?: number };

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

// Primary label uses a fixed width (no CSS-var trigger width), so it doesn't inherit triggerWidth.
export type SelectPrimaryLabelProps = TaskSubscriptionProps & {
  /** Current primary label id (a task's `primaryLabelId`). */
  value: string;
  projectId: string;
  onChange: (newValue: string) => void;
  className?: string;
};
