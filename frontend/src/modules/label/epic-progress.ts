import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';

/** An epic's tasks by how far along they are. Iced tasks count in none, so parked work does not hold an epic back. */
export interface EpicProgress {
  toDo: number;
  inProgress: number;
  done: number;
}

export type EpicPart = keyof EpicProgress;

/** The bar's parts in board order, each with the statuses a press puts in the board search. */
export const epicParts = [
  { part: 'toDo', title: 'c:to_do', statuses: [TaskStatus.Unstarted] },
  { part: 'inProgress', title: 'c:in_progress', statuses: [TaskStatus.Started, TaskStatus.Finished, TaskStatus.Reviewed] },
  { part: 'done', title: 'c:done', statuses: [TaskStatus.Accepted] },
] as const satisfies { part: EpicPart; title: string; statuses: TaskStatus[] }[];

export const noEpicProgress: EpicProgress = { toDo: 0, inProgress: 0, done: 0 };

export const epicPartOf = (status: TaskStatus): EpicPart | null =>
  epicParts.find(({ statuses }) => (statuses as readonly TaskStatus[]).includes(status))?.part ?? null;

/** The status ids of a part, as the board search writes them. */
export const epicPartStatusIds = (part: EpicPart): string[] =>
  epicParts.find((entry) => entry.part === part)?.statuses.map((status) => statusOptionsByValue[status].status) ?? [];

export const epicTotal = ({ toDo, inProgress, done }: EpicProgress) => toDo + inProgress + done;

/** The done share as a whole percentage; an epic without tasks is at 0. */
export const epicDonePercent = (progress: EpicProgress) => {
  const total = epicTotal(progress);
  return total ? Math.round((progress.done / total) * 100) : 0;
};
