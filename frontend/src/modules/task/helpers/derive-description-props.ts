import { blocksToHTML } from '~/modules/common/blocknote/helpers/blocknote-helpers';
import type { CustomBlock } from '~/modules/common/blocknote/types';

export type DerivedDescriptionCounts = {
  expandable: boolean;
  checkboxCount: number;
  checkedCount: number;
  attachmentCount: number;
};

export type DerivedDescriptionProps = DerivedDescriptionCounts & {
  summary: string;
  summaryLength: number;
};

const mediaTypes = new Set(['audio', 'video', 'image', 'file']);
const skipForSummary = new Set(['checklistItem']);

/**
 * Parse description blocks once and extract all count-based derived properties.
 * Synchronous — safe for optimistic updates in onMutate.
 */
export const deriveDescriptionCounts = (description: string): DerivedDescriptionCounts => {
  try {
    const blocks = JSON.parse(description) as CustomBlock[];
    let checkboxCount = 0;
    let checkedCount = 0;
    let attachmentCount = 0;

    const walk = (items: CustomBlock[]) => {
      for (const block of items) {
        if (block.type === 'checklistItem') {
          checkboxCount++;
          if (block.props && 'checked' in block.props && block.props.checked) checkedCount++;
        }
        if (
          mediaTypes.has(block.type) &&
          'url' in block.props &&
          typeof block.props.url === 'string' &&
          block.props.url.trim().length > 0
        ) {
          attachmentCount++;
        }
        if (block.children?.length) walk(block.children as CustomBlock[]);
      }
    };
    walk(blocks);

    return { expandable: blocks.length > 1, checkboxCount, checkedCount, attachmentCount };
  } catch {
    return { expandable: false, checkboxCount: 0, checkedCount: 0, attachmentCount: 0 };
  }
};

/**
 * Derive all description properties including summary (async due to HTML conversion).
 * Single parse, single walk — replaces getSummary + countAllMediaAttachments + inline parsing.
 */
export const deriveDescriptionProps = async (description: string): Promise<DerivedDescriptionProps> => {
  const blocks = JSON.parse(description) as CustomBlock[];
  let checkboxCount = 0;
  let checkedCount = 0;
  let attachmentCount = 0;

  const walk = (items: CustomBlock[]) => {
    for (const block of items) {
      if (block.type === 'checklistItem') {
        checkboxCount++;
        if (block.props && 'checked' in block.props && block.props.checked) checkedCount++;
      }
      if (
        mediaTypes.has(block.type) &&
        'url' in block.props &&
        typeof block.props.url === 'string' &&
        block.props.url.trim().length > 0
      ) {
        attachmentCount++;
      }
      if (block.children?.length) walk(block.children as CustomBlock[]);
    }
  };
  walk(blocks);

  // Find summary source: first non-checklist block with text content
  const summarySource =
    blocks.find(
      ({ type, content }) =>
        !skipForSummary.has(type) &&
        Array.isArray(content) &&
        content.some((item) => 'text' in item && !!item.text.trim()),
    ) || blocks[0];

  const summaryLength = Array.isArray(summarySource?.content)
    ? summarySource.content.reduce((len, item) => len + ('text' in item && item.text ? item.text.length : 0), 0)
    : 0;

  const html = await blocksToHTML(JSON.stringify([summarySource]));
  const summary = html.replace(/^<p[^>]*>(.*)<\/p>$/s, '$1');

  return {
    summary,
    summaryLength,
    expandable: blocks.length > 1,
    checkboxCount,
    checkedCount,
    attachmentCount,
  };
};
