import { foldText, trimAroundMatch } from 'shared/utils/text-match';
import { descriptionText, summaryText } from '~/modules/task/helpers/search-filter';
import type { Task } from '~/modules/task/types';

type MatchReason = { description?: string; people: string[] };

/** Why a task matched when nothing it shows contains a term: the description window around the first hidden term, and matching assignees. */
export const hiddenMatchReason = (task: Task, terms: string[]): MatchReason | null => {
  if (!terms.length) return null;
  const visible = [summaryText(task).folded, ...task.labels.map(({ name }) => foldText(name))];
  const hidden = terms.filter((term) => !visible.some((field) => field.includes(term)));
  if (!hidden.length) return null;

  const description = descriptionText(task);
  const inDescription = hidden.filter((term) => description.folded.includes(term));
  const people = task.assignedTo.filter(({ name }) => hidden.some((term) => foldText(name).includes(term))).map(({ name }) => name);
  if (!inDescription.length && !people.length) return null;

  return { description: inDescription.length ? trimAroundMatch(description.text, inDescription, 100) : undefined, people };
};
