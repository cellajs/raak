import type { Block } from '@blocknote/core';
import { getSearchableTextFromBlocks } from 'shared/blocknote';
import { foldText, matchesTerms, parseTerms } from 'shared/utils/text-match';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import type { Task } from '~/modules/task/types';

type SearchableText = { text: string; folded: string };

// Cached by task identity: React Query preserves unchanged references, and the WeakMaps release evicted tasks
const descriptionCache = new WeakMap<Task, SearchableText>();
const summaryCache = new WeakMap<Task, SearchableText>();

const searchableText = (cache: WeakMap<Task, SearchableText>, task: Task, document: string | null): SearchableText => {
  const cached = cache.get(task);
  if (cached) return cached;
  const text = document ? getSearchableTextFromBlocks(JSON.parse(document) as Block[]) : '';
  const entry = { text, folded: foldText(text) };
  cache.set(task, entry);
  return entry;
};

/** The description as plain text, parsed once per task object. */
export const descriptionText = (task: Task) => searchableText(descriptionCache, task, task.description);

/** The summary (the description's first block) as plain text, parsed once per task object. */
export const summaryText = (task: Task) => searchableText(summaryCache, task, task.summary);

const searchFields = (task: Task) => [
  descriptionText(task).folded,
  foldText(task.keywords),
  ...task.labels.map(({ name }) => foldText(name)),
  ...task.assignedTo.map(({ name }) => foldText(name)),
];

/** Whether a task matches the board search; the create form always does. list-tasks.ts is the server leg of the same rule. */
export const matchesBoardSearch = (q: string | undefined, task: Task): boolean => {
  const terms = parseTerms(q);
  return !terms.length || isDraftTask(task) || matchesTerms(searchFields(task), terms);
};
