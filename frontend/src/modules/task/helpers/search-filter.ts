import type { Block } from '@blocknote/core';
import { getSearchableTextFromBlocks } from 'shared/blocknote';
import { foldText, matchesTerms, parseTerms } from 'shared/utils/text-match';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { statusOptionsByValue } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';
import type { RecentListSearch } from '~/utils/recent-searches';

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

/** A board search as it stands in the URL: words in `q`, each filter's values comma-separated. */
export interface BoardSearch {
  q?: string;
  status?: string;
  type?: string;
  labels?: string;
}

const filterValues = (value?: string) => (value ? value.split(',') : []);

/** A filter's value in the URL after a value's toggle; undefined with no value left. */
export const toggleFilterValue = (value: string | undefined, toggled: string) => {
  const values = filterValues(value);
  return (values.includes(toggled) ? values.filter((other) => other !== toggled) : [...values, toggled]).join(',') || undefined;
};

/** A filter's value in the URL with one value swapped for another, in the same place. */
export const replaceFilterValue = (value: string, from: string, to: string) =>
  filterValues(value)
    .map((other) => (other === from ? to : other))
    .join(',');

export const parseBoardSearch = ({ q, status, type, labels }: BoardSearch) => ({
  terms: parseTerms(q),
  statuses: filterValues(status),
  types: filterValues(type),
  labels: filterValues(labels),
});

export type ParsedBoardSearch = ReturnType<typeof parseBoardSearch>;

export const isBoardSearchActive = ({ terms, statuses, types, labels }: ParsedBoardSearch) =>
  terms.length > 0 || statuses.length > 0 || types.length > 0 || labels.length > 0;

/** Whether a search earns a recent's place: a lone status or type is always in plain sight among the options, a label may be scrolled off. */
export const isWorthRecalling = ({ q, filters: { status = [], type = [], labels = [] } }: RecentListSearch) =>
  !!q || labels.length > 0 || status.length + type.length > 1;

/** Whether a task passes each part of the search, so a filter's counts can leave that filter out. */
export const boardSearchParts = (search: ParsedBoardSearch, task: Task) => ({
  words: !search.terms.length || matchesTerms(searchFields(task), search.terms),
  status: !search.statuses.length || search.statuses.includes(statusOptionsByValue[task.status].status),
  type: !search.types.length || (!!task.primaryLabel && search.types.includes(task.primaryLabel.slug)),
  labels: !search.labels.length || task.labels.some(({ slug }) => search.labels.includes(slug)),
});

/** Whether a task matches the board search; the create form always does. list-tasks.ts is the server leg of the same rule. */
export const matchesBoardSearch = (search: ParsedBoardSearch, task: Task): boolean => {
  if (isDraftTask(task)) return true;
  const { words, status, type, labels } = boardSearchParts(search, task);
  return words && status && type && labels;
};
