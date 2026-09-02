import {
  countDescriptionBlocks,
  type DescriptionBlock,
  type DescriptionCounts,
  emptyDescriptionCounts,
  findSummarySource,
} from 'shared/utils/derive-description-core';
import { blocksToHTML } from '~/modules/common/blocknote/helpers/blocknote-helpers';
import type { CustomBlock } from '~/modules/common/blocknote/types';

// fork: attachmentCount is presentation-only (attachments.length) since task.attachments is an
// owned embedding derived from the description media blocks; the wire object carries no count.
export type DerivedDescriptionCounts = Omit<DescriptionCounts, 'attachmentCount'>;

export type DerivedDescriptionProps = DerivedDescriptionCounts & {
  summary: string;
  summaryLength: number;
};

const stripCount = ({ attachmentCount: _attachmentCount, ...counts }: DescriptionCounts): DerivedDescriptionCounts =>
  counts;

/** Synchronous, so it is safe for optimistic updates in onMutate; the walk is shared with the backend. */
export const deriveDescriptionCounts = (description: string): DerivedDescriptionCounts => {
  try {
    return stripCount(countDescriptionBlocks(JSON.parse(description) as DescriptionBlock[]));
  } catch {
    return stripCount(emptyDescriptionCounts());
  }
};

/** Async because the summary needs HTML conversion. */
export const deriveDescriptionProps = async (description: string): Promise<DerivedDescriptionProps> => {
  const blocks = JSON.parse(description) as CustomBlock[];
  const counts = stripCount(countDescriptionBlocks(blocks as DescriptionBlock[]));

  const { source, summaryLength } = findSummarySource(blocks as DescriptionBlock[]);

  const html = source ? await blocksToHTML(JSON.stringify([source])) : '';
  const summary = html.replace(/^<p[^>]*>(.*)<\/p>$/s, '$1');

  return { summary, summaryLength, ...counts };
};
