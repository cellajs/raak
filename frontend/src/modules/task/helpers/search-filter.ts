import type { Block } from '@blocknote/core';
import { getSearchableTextFromBlocks } from 'shared/blocknote';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { containsWord, foldText, matchesTerms } from 'shared/utils/text-match';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import type { BoardSearchParams, Task } from '~/modules/task/types';

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

const hasExcludedWord = (fields: string[], excludeTerms: string[]) => excludeTerms.some((term) => fields.some((field) => containsWord(field, term)));

/** Whether a '-' word or phrase of the board search leaves the task out, in either mode; the create form never leaves. */
export const isExcludedBySearch = (q: string | undefined, task: Task) => {
  const { excludeTerms } = parseSearchQuery(q);
  return excludeTerms.length > 0 && !isDraftTask(task) && hasExcludedWord(searchFields(task), excludeTerms);
};

/** Whether a task matches the board search, exclusions included; list-tasks.ts is the server leg of the same rule. */
export const matchesBoardSearch = (searchParams: { q?: string; matchMode?: BoardSearchParams['matchMode'] }, task: Task): boolean => {
  const { q, matchMode = 'all' } = searchParams;
  const { terms, excludeTerms } = parseSearchQuery(q);

  if ((!terms.length && !excludeTerms.length) || isDraftTask(task)) return true;

  const fields = searchFields(task);
  if (hasExcludedWord(fields, excludeTerms)) return false;
  return !terms.length || matchesTerms(fields, terms, matchMode);
};
