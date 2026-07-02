import type { Block } from '@blocknote/core';
import { getTextFromBlock } from 'shared/blocknote';
import type { Task, TaskSearch } from '~/modules/task/types';

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

  // Helper
  const filterFn = (item: string) =>
    matchMode === 'all' ? item.includes(rawQuery) : keywords.some((w) => item.includes(w));

  // Extract plain text from description blocks
  const parseBlocksText = (json: string | null) =>
    json ? (JSON.parse(json) as Block[]).map(getTextFromBlock).join(' ').toLowerCase() : '';

  // Task fields
  const { description, keywords: taskKeywords, labels, assignedTo } = task;
  const descriptionText = parseBlocksText(description);

  // Search in description
  const descriptionMatch =
    matchMode === 'all' ? descriptionText.includes(rawQuery) : keywords.some((k) => taskKeywords.includes(k));
  // Search in assigned  labels
  const peopleMatch = assignedTo.some(({ name }) => filterFn(name));
  // Search in  labels
  const labelsMatch = labels.some(({ name }) => filterFn(name));
  return descriptionMatch || peopleMatch || labelsMatch;
};
