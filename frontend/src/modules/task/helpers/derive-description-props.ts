import {
  countDescriptionBlocks,
  type DescriptionBlock,
  type DescriptionCounts,
  emptyDescriptionCounts,
  findSummarySource,
} from 'shared/utils/derive-description-core';
import { blocksToHTML } from '~/modules/common/blocknote/helpers/blocknote-helpers';
import type { CustomBlock } from '~/modules/common/blocknote/types';

export type DerivedDescriptionCounts = DescriptionCounts;

export type DerivedDescriptionProps = DerivedDescriptionCounts & {
  summary: string;
  summaryLength: number;
};

/**
 * Parse description blocks once and extract all count-based derived properties.
 * Synchronous and safe for optimistic updates in onMutate. The walk itself is shared
 * with the backend (derive-description-core) so the two sides cannot drift.
 */
export const deriveDescriptionCounts = (description: string): DerivedDescriptionCounts => {
  try {
    return countDescriptionBlocks(JSON.parse(description) as DescriptionBlock[]);
  } catch {
    return emptyDescriptionCounts();
  }
};

/**
 * Derive all description properties including summary (async due to HTML conversion).
 * Uses a single parse and walk for summary and count derivation.
 */
export const deriveDescriptionProps = async (description: string): Promise<DerivedDescriptionProps> => {
  const blocks = JSON.parse(description) as CustomBlock[];
  const counts = countDescriptionBlocks(blocks as DescriptionBlock[]);

  const { source, summaryLength } = findSummarySource(blocks as DescriptionBlock[]);

  const html = source ? await blocksToHTML(JSON.stringify([source])) : '';
  const summary = html.replace(/^<p[^>]*>(.*)<\/p>$/s, '$1');

  return { summary, summaryLength, ...counts };
};
