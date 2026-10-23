import type { Block } from '@blocknote/core';
import { getSearchableTextFromBlocks } from 'shared/blocknote';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { foldText, matchesTerms } from 'shared/utils/text-match';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import type { BoardSearchParams, Task } from '~/modules/task/types';

type SearchableText = { text: string; folded: string };

// Cached by task identity: React Query preserves unchanged references, and the WeakMaps release
// tasks after cache eviction.
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

/** Whether a task matches the board search; list-tasks.ts is the server leg of the same rule. */
export const searchFilterFunction = (searchParams: { q?: string; matchMode?: BoardSearchParams['matchMode'] }, task: Task): boolean => {
  const { q, matchMode = 'all' } = searchParams;
  const { terms } = parseSearchQuery(q);

  if (!terms.length || isDraftTask(task)) return true;

  const { keywords, labels, assignedTo } = task;
  const fields = [
    descriptionText(task).folded,
    foldText(keywords),
    ...labels.map(({ name }) => foldText(name)),
    ...assignedTo.map(({ name }) => foldText(name)),
  ];
  return matchesTerms(fields, terms, matchMode);
};
