import type { Block } from '@blocknote/core';
import { getSearchableTextFromBlocks } from 'shared/blocknote';
import type { Task, TaskSearch } from '~/modules/task/types';

// Parsing the BlockNote description JSON is the expensive part of the filter (it runs per task on
// every keystroke / cache event in board mode and the offline table filter). Cache it keyed by the
// task object: react-query structural-shares unchanged tasks, so this hits across renders, and a
// WeakMap needs no manual eviction — entries are GC'd once a task object leaves the cache.
const descriptionTextCache = new WeakMap<Task, string>();
const getDescriptionText = (task: Task): string => {
  const cached = descriptionTextCache.get(task);
  if (cached !== undefined) return cached;
  const text = task.description
    ? getSearchableTextFromBlocks(JSON.parse(task.description) as Block[]).toLowerCase()
    : '';
  descriptionTextCache.set(task, text);
  return text;
};

/**
 * Search filter function for tasks based on search parameters.
 */
export const searchFilterFunction = (
  searchParams: { q?: string; matchMode?: TaskSearch['matchMode'] },
  task: Task,
): boolean => {
  const { q: searchQuery, matchMode = 'all' } = searchParams;

  // Normalize query
  const trimmed = searchQuery?.trim().toLowerCase();
  const rawQuery = trimmed?.startsWith('=') ? trimmed.slice(1) : trimmed;

  // Always allow empty query or create-task
  if (!rawQuery || task.id.startsWith('create-task')) return true;

  // Split into keywords
  const keywords = rawQuery
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean);

  if (keywords.length === 0) return true; // No filtering if there are no valid search keywords

  // Task fields (description text is parsed once per task via the cache above)
  const { keywords: taskKeywords, labels, assignedTo } = task;
  const searchableText = [
    getDescriptionText(task),
    taskKeywords.toLowerCase(),
    ...labels.map(({ name }) => name.toLowerCase()),
    ...assignedTo.map(({ name }) => name.toLowerCase()),
  ];

  const matchesKeyword = (keyword: string) => searchableText.some((item) => item.includes(keyword));

  return matchMode === 'all' ? keywords.every(matchesKeyword) : keywords.some(matchesKeyword);
};
