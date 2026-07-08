import type { UserMinimalBase } from 'sdk';
import type { TaskLabel, TaskPointsType, TaskStatusType, TaskVariantType } from '~/modules/task/types';

export type DropdownsType = 'points' | 'labels' | 'assignedTo' | 'status' | 'variant';

/**
 * Optional id of the task this dropdown is editing. When present, the dropdown
 * subscribes to the task in the cache and reflects live updates (e.g. from SSE)
 * while open. Omit for create-task forms.
 */
type TaskSubscriptionProps = { taskId?: string };

/** Layout props for the CSS-var-width dropdowns (points/labels/members/status). */
type DropdownLayoutProps = TaskSubscriptionProps & { triggerWidth?: number };

/** Value/onChange props per dropdown type without a Task dependency. */
export type SelectPointsProps = DropdownLayoutProps & {
  /** Current stored points (a task's `points` — the backend contract is `number | null`). */
  value: number | null;
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

// Variant uses a fixed width (no CSS-var trigger width), so it doesn't inherit triggerWidth.
export type SelectVariantProps = TaskSubscriptionProps & {
  value: TaskVariantType;
  onChange: (newValue: TaskVariantType) => void;
  className?: string;
};
