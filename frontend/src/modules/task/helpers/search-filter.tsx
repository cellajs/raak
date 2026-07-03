import type { Block } from '@blocknote/core';
import { getSearchableTextFromBlocks } from 'shared/blocknote';
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

  // Extract searchable text from description blocks, including safe URL metadata
  const parseBlocksText = (json: string | null) =>
    json ? getSearchableTextFromBlocks(JSON.parse(json) as Block[]).toLowerCase() : '';

  // Task fields
  const { description, keywords: taskKeywords, labels, assignedTo } = task;
  const searchableText = [
    parseBlocksText(description),
    taskKeywords.toLowerCase(),
    ...labels.map(({ name }) => name.toLowerCase()),
    ...assignedTo.map(({ name }) => name.toLowerCase()),
  ];

  const matchesKeyword = (keyword: string) => searchableText.some((item) => item.includes(keyword));

  return matchMode === 'all' ? keywords.every(matchesKeyword) : keywords.some(matchesKeyword);
};
