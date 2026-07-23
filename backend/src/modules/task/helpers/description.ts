import type { Block } from '@blocknote/core';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { getSearchableTextFromBlocks } from 'shared/blocknote';
import {
  blockPlainText,
  countDescriptionBlocks,
  type DescriptionBlock,
  emptyDescriptionCounts,
  findSummarySource,
} from 'shared/utils/derive-description-core';
import { validUuidSchema } from '#/schemas';
import { extractKeywords } from '#/utils/extract-keywords';

// Reuse a single editor instance; schema construction is expensive, conversions are stateless.
const editor = ServerBlockNoteEditor.create();

/** Loose block type for parsed JSON, including custom block types outside @blocknote/core's Block union. */
export type ParsedBlock = DescriptionBlock;

export type DerivedDescriptionProps = {
  summary: string;
  summaryLength: number;
  expandable: boolean;
  checkboxCount: number;
  checkedCount: number;
  attachmentCount: number;
  /** Attachment entity ids referenced by media blocks; the owned-embedding host array. */
  attachments: string[];
  keywords: string;
};

/**
 * Derive all virtual properties from a BlockNote description in a single parse + walk.
 * Count derivation is shared with the frontend (derive-description-core); keyword
 * extraction and HTML summary conversion are backend-only. Collected attachment ids
 * are narrowed to UUID shape so they can safely enter the uuid[] host column.
 */
export const deriveDescriptionProps = async (
  description: string,
  preParsed?: ParsedBlock[],
): Promise<DerivedDescriptionProps> => {
  const blocks: ParsedBlock[] = preParsed ?? (description ? JSON.parse(description) : []);

  const counts = blocks.length ? countDescriptionBlocks(blocks) : emptyDescriptionCounts();
  counts.attachments = counts.attachments.filter((id) => validUuidSchema.safeParse(id).success);

  const result: DerivedDescriptionProps = { summary: '', summaryLength: 0, keywords: '', ...counts };
  if (!blocks.length) return result;

  // Extract keywords from already-parsed blocks.
  // Cast rationale: ParsedBlock is looser than @blocknote/core's Block union (custom block types).
  const fullText = getSearchableTextFromBlocks(blocks as unknown as Block[]);
  result.keywords = extractKeywords(fullText);

  const { source, summaryLength } = findSummarySource(blocks);
  result.summaryLength = summaryLength;
  if (!source) return result;

  if (source.type === 'checklistItem') {
    // Custom block types (e.g. checklistItem) aren't in the server schema; extract text directly.
    result.summary = blockPlainText(source);
  } else {
    const html = await editor.blocksToHTMLLossy([source as unknown as Block]);
    result.summary = html.replace(/^<p[^>]*>(.*)<\/p>$/s, '$1');
  }

  return result;
};
