import { AcceptedIcon } from '~/modules/task/dropdowns/status-icons/accepted';
import { DeliveredIcon } from '~/modules/task/dropdowns/status-icons/delivered';
import { FinishedIcon } from '~/modules/task/dropdowns/status-icons/finished';
import { IcedIcon } from '~/modules/task/dropdowns/status-icons/iced';
import { ReviewedIcon } from '~/modules/task/dropdowns/status-icons/reviewed';
import { StartedIcon } from '~/modules/task/dropdowns/status-icons/started';
import { UnstartedIcon } from '~/modules/task/dropdowns/status-icons/unstarted';

/**
 * Task status as enum, ordered by workflow (Accepted = completed, Unstarted = not started).
 */
export enum TaskStatus {
  Iced = 6,
  Unstarted = 5,
  Started = 4,
  Finished = 3,
  Delivered = 2,
  Reviewed = 1,
  Accepted = 0,
}

/**
 * Number of days after which accepted tasks on the board are automatically moved to the backlog.
 * This is a soft rule to keep the board tidy, not a hard cutoff.
 */
export const boardAcceptedCutOff = 14; //in days

/**
 * Task status options as array with metadata for rendering.
 */
export const statusOptions = [
  { value: TaskStatus.Accepted, action: 'accepted', status: 'accepted', icon: AcceptedIcon },
  { value: TaskStatus.Reviewed, action: 'accept', status: 'reviewed', icon: ReviewedIcon },
  { value: TaskStatus.Delivered, action: 'review', status: 'delivered', icon: DeliveredIcon },
  { value: TaskStatus.Finished, action: 'deliver', status: 'finished', icon: FinishedIcon },
  { value: TaskStatus.Started, action: 'finish', status: 'started', icon: StartedIcon },
  { value: TaskStatus.Unstarted, action: 'start', status: 'unstarted', icon: UnstartedIcon },
  { value: TaskStatus.Iced, action: 'iced', status: 'iced', icon: IcedIcon },
] as const;

/**
 * Value-keyed lookup for the status options. Prefer this over positional indexing
 * (`statusOptions[value]`), which only works while the array order happens to match
 * the enum values and breaks silently on reorder.
 */
const byValue = <T extends { value: number }>(options: readonly T[]): Record<number, T> =>
  Object.fromEntries(options.map((o) => [o.value, o]));

export const statusOptionsByValue = byValue(statusOptions) as Record<
  (typeof statusOptions)[number]['value'],
  (typeof statusOptions)[number]
>;
