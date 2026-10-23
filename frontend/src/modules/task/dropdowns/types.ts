import type { UserMinimalBase } from 'sdk';
import type { TaskLabel, TaskStatusType } from '~/modules/task/types';

export type TaskDropdownType = 'labels' | 'assignedTo' | 'status' | 'primaryLabel';

/** Id of the task being edited: the dropdown then follows its live cache updates (e.g. SSE) while open. Omit for create forms. */
type TaskSubscriptionProps = { taskId?: string };

/** Layout props for the CSS-var-width dropdowns (labels/members/status). */
type DropdownLayoutProps = TaskSubscriptionProps & { triggerWidth?: number };

export type SelectLabelsProps = DropdownLayoutProps & {
  value: TaskLabel[];
  projectId: string;
  onChange: (labels: TaskLabel[]) => void;
  /** Defaults to collapsed on desktop and expanded on mobile; openers that already show the selected labels pass `true`. */
  initialSelectedCollapsed?: boolean;
};

export type SelectMembersProps = DropdownLayoutProps & { value: UserMinimalBase[]; projectId: string; onChange: (users: UserMinimalBase[]) => void };

/** `value` is absent for selected tasks whose statuses differ. */
export type SelectStatusProps = DropdownLayoutProps & { value?: TaskStatusType; onChange: (newValue: TaskStatusType) => void };

// Fixed width, so it takes no triggerWidth.
export type SelectPrimaryLabelProps = TaskSubscriptionProps & {
  /** Current primary label id (a task's `primaryLabelId`). */
  value: string;
  projectId: string;
  onChange: (newValue: string) => void;
};
