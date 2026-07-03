import { BoltIcon, BugIcon, StarIcon } from 'lucide-react';
import { HighIcon } from '~/modules/task/dropdowns/point-icons/high';
import { LowIcon } from '~/modules/task/dropdowns/point-icons/low';
import { MediumIcon } from '~/modules/task/dropdowns/point-icons/medium';
import { NoneIcon } from '~/modules/task/dropdowns/point-icons/none';
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
 * Task variant as enum.
 */
export enum TaskVariant {
  Feature = 1,
  Chore = 2,
  Bug = 3,
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
 * Task variant options as array with metadata for rendering.
 */
export const variantOptions = [
  {
    value: TaskVariant.Feature,
    type: 'Feature',
    labelKey: 'feature',
    icon: () => <StarIcon size={16} className="shrink-0 fill-amber-400 text-amber-500" />,
  },
  {
    value: TaskVariant.Chore,
    type: 'Chore',
    labelKey: 'chore',
    icon: () => <BoltIcon size={16} className="shrink-0 fill-slate-400 text-slate-500" />,
  },
  {
    value: TaskVariant.Bug,
    type: 'Bug',
    labelKey: 'bug',
    icon: () => <BugIcon size={16} className="fill-red-400 text-red-500" />,
  },
] as const;

/**
 * Task point options with metadata for rendering.
 */
export const pointsOptions = [
  { value: 'none', label: '0', icon: NoneIcon },
  { value: 'low', label: '1', icon: LowIcon },
  { value: 'medium', label: '2', icon: MediumIcon },
  { value: 'high', label: '3', icon: HighIcon },
] as const;
