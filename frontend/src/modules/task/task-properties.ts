import { AcceptedIcon } from '~/modules/task/dropdowns/status-icons/accepted';
import { FinishedIcon } from '~/modules/task/dropdowns/status-icons/finished';
import { IcedIcon } from '~/modules/task/dropdowns/status-icons/iced';
import { ReviewedIcon } from '~/modules/task/dropdowns/status-icons/reviewed';
import { StartedIcon } from '~/modules/task/dropdowns/status-icons/started';
import { UnstartedIcon } from '~/modules/task/dropdowns/status-icons/unstarted';

/** Task status in workflow order: Accepted is completed, Unstarted is not started. The values are stored, so 2 (an older Delivered step, retired) stays a gap. */
export enum TaskStatus {
  Iced = 6,
  Unstarted = 5,
  Started = 4,
  Finished = 3,
  Reviewed = 1,
  Accepted = 0,
}

/** Accepted tasks past this many days are left out of the board query. */
export const boardAcceptedCutOffDays = 14;

// status: the id in URLs, the API and saved searches, so a rename changes name only (Finished reads as Delivered).
// action: the next step from a status, on its card's button; Accepted has none and shows its name. verb: the step that moves a task into it, as the status menu lists it; Backlog keeps its name.
export const statusOptions = [
  {
    value: TaskStatus.Accepted,
    action: 'accepted',
    next: TaskStatus.Accepted,
    status: 'accepted',
    name: 'accepted',
    verb: 'accept',
    icon: AcceptedIcon,
  },
  {
    value: TaskStatus.Reviewed,
    action: 'accept',
    next: TaskStatus.Accepted,
    status: 'reviewed',
    name: 'reviewed',
    verb: 'review',
    icon: ReviewedIcon,
  },
  {
    value: TaskStatus.Finished,
    action: 'review',
    next: TaskStatus.Reviewed,
    status: 'finished',
    name: 'delivered',
    verb: 'deliver',
    icon: FinishedIcon,
  },
  { value: TaskStatus.Started, action: 'deliver', next: TaskStatus.Finished, status: 'started', name: 'started', verb: 'start', icon: StartedIcon },
  {
    value: TaskStatus.Unstarted,
    action: 'start',
    next: TaskStatus.Started,
    status: 'unstarted',
    name: 'unstarted',
    verb: 'unstarted',
    icon: UnstartedIcon,
  },
  { value: TaskStatus.Iced, action: 'thaw', next: TaskStatus.Unstarted, status: 'iced', name: 'iced', verb: 'ice', icon: IcedIcon },
] as const;

/** Value-keyed lookup: the enum values have a gap, so `statusOptions[value]` misses. */
const byValue = <T extends { value: number }>(options: readonly T[]): Record<number, T> =>
  Object.fromEntries(options.map((option) => [option.value, option]));

export const statusOptionsByValue = byValue(statusOptions) as Record<(typeof statusOptions)[number]['value'], (typeof statusOptions)[number]>;
