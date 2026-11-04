import { getSearchableTextFromBlocks, parseBlocks } from 'shared/blocknote';
import { foldText, matchesTerms, parseTerms } from 'shared/utils/text-match';
import type { RecentBoardSearch } from '~/modules/task/board/task-board-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { statusOptions, statusOptionsByValue } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

type SearchableText = { text: string; folded: string };

// Cached by task identity: React Query preserves unchanged references, and the WeakMaps release evicted tasks
const descriptionCache = new WeakMap<Task, SearchableText>();
const summaryCache = new WeakMap<Task, SearchableText>();

const searchableText = (cache: WeakMap<Task, SearchableText>, task: Task, document: string | null): SearchableText => {
  const cached = cache.get(task);
  if (cached) return cached;
  const text = document ? getSearchableTextFromBlocks(parseBlocks(document) ?? []) : '';
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

// `#123` names a task by number; list-tasks.ts is the server leg of the same rule
const numberTerm = (term: string) => {
  const match = term.match(/^#(\d+)$/);
  return match ? Number(match[1]) : null;
};

const matchesSearchTerms = (task: Task, terms: string[]) => {
  const numbers = terms.map(numberTerm).filter((number): number is number => number !== null);
  const words = terms.filter((term) => numberTerm(term) === null);
  return numbers.every((number) => task.number === number) && (!words.length || matchesTerms(searchFields(task), words));
};

/** A board search as it stands in the URL: words in `q`, each filter's values comma-separated. */
export interface BoardSearch {
  q?: string;
  status?: string;
  type?: string;
  labels?: string;
  assigned?: string;
}

/** The `assigned` value for tasks assigned to no one; user ids never take this form. */
export const noAssignee = 'none';

export const filterValues = (value?: string) => (value ? value.split(',') : []);

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

const statusNames = new Set<string>(statusOptions.map(({ status }) => status));

export const parseBoardSearch = ({ q, status, type, labels, assigned }: BoardSearch) => ({
  terms: parseTerms(q),
  // A bookmark or recent search can name a retired status: nothing would match it and no chip could clear it
  statuses: filterValues(status).filter((name) => statusNames.has(name)),
  types: filterValues(type),
  labels: filterValues(labels),
  assignees: filterValues(assigned),
});

export type ParsedBoardSearch = ReturnType<typeof parseBoardSearch>;

/** The filters without the types, labels and assignees none of `tasks` carries: no chip could name them, and nothing would match. You and No one always have a name. */
export const fitBoardSearch = (
  { type, labels, assigned }: BoardSearch,
  tasks: Task[],
  userId?: string,
): Pick<BoardSearch, 'type' | 'labels' | 'assigned'> => {
  const carried = { type: new Set<string>(), labels: new Set<string>(), assigned: new Set([noAssignee, ...(userId ? [userId] : [])]) };
  for (const task of tasks) {
    if (task.primaryLabel) carried.type.add(task.primaryLabel.slug);
    for (const { slug } of task.labels) carried.labels.add(slug);
    for (const { id } of task.assignedTo) carried.assigned.add(id);
  }
  const keep = (value: string | undefined, known: Set<string>) =>
    filterValues(value)
      .filter((other) => known.has(other))
      .join(',') || undefined;
  return { type: keep(type, carried.type), labels: keep(labels, carried.labels), assigned: keep(assigned, carried.assigned) };
};

export const isBoardSearchActive = ({ terms, statuses, types, labels, assignees }: ParsedBoardSearch) =>
  terms.length > 0 || statuses.length > 0 || types.length > 0 || labels.length > 0 || assignees.length > 0;

/** Whether a search earns a recent's place: a lone status, type or member is always in plain sight among the options, a label may be scrolled off, and words alone need three characters. */
export const isWorthRecalling = ({ q, status, type, labels, assigned }: RecentBoardSearch) => {
  const filterCount = status.length + type.length + assigned.length;
  return labels.length > 0 || filterCount > 1 || q.trim().length >= (filterCount ? 1 : 3);
};

/** Whether a task passes each part of the search, so a filter's counts can leave that filter out. */
export const boardSearchParts = (search: ParsedBoardSearch, task: Task) => ({
  words: !search.terms.length || matchesSearchTerms(task, search.terms),
  status: !search.statuses.length || search.statuses.includes(statusOptionsByValue[task.status].status),
  type: !search.types.length || (!!task.primaryLabel && search.types.includes(task.primaryLabel.slug)),
  labels: !search.labels.length || task.labels.some(({ slug }) => search.labels.includes(slug)),
  assigned:
    !search.assignees.length ||
    (task.assignedTo.length ? task.assignedTo.some(({ id }) => search.assignees.includes(id)) : search.assignees.includes(noAssignee)),
});

/** Whether a task matches the board search; the create form always does. list-tasks.ts is the server leg of the same rule. */
export const matchesBoardSearch = (search: ParsedBoardSearch, task: Task): boolean => {
  if (isDraftTask(task)) return true;
  const { words, status, type, labels, assigned } = boardSearchParts(search, task);
  return words && status && type && labels && assigned;
};
