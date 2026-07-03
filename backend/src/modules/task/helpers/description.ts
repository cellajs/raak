import type { Block } from '@blocknote/core';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { and, inArray, isNull } from 'drizzle-orm';
import { getSearchableTextFromBlocks, mediaBlockTypes } from 'shared/blocknote';
import type { DbContext } from '#/core/context';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import { findAttachmentKeysByGroupId } from '#/modules/attachment/attachment-queries';
import { extractKeywords } from '#/utils/extract-keywords';
import { getIsoDate } from '#/utils/iso-date';

// Reuse a single editor instance — schema construction is expensive, conversions are stateless
const editor = ServerBlockNoteEditor.create();

// Loose block type for parsed JSON — includes custom block types not in @blocknote/core's Block union
export type ParsedBlock = {
  type: string;
  props: Record<string, unknown>;
  content?: unknown[];
  children?: ParsedBlock[];
};

export type DerivedDescriptionProps = {
  summary: string;
  summaryLength: number;
  expandable: boolean;
  checkboxCount: number;
  checkedCount: number;
  attachmentCount: number;
  keywords: string;
};

/**
 * Derive all virtual properties from a BlockNote description in a single parse + walk.
 * Replaces the previous scanTaskDescription() + getSummary() pair.
 */
export const deriveDescriptionProps = async (
  description: string,
  preParsed?: ParsedBlock[],
): Promise<DerivedDescriptionProps> => {
  const blocks: ParsedBlock[] = preParsed ?? (description ? JSON.parse(description) : []);

  const result: DerivedDescriptionProps = {
    summary: '',
    summaryLength: 0,
    expandable: false,
    checkboxCount: 0,
    checkedCount: 0,
    attachmentCount: 0,
    keywords: '',
  };

  if (!blocks.length) return result;

  const walk = (items: ParsedBlock[]) => {
    for (const block of items) {
      if (block.type === 'checklistItem') {
        result.checkboxCount++;
        if (block.props?.checked) result.checkedCount++;
      }
      if (
        mediaBlockTypes.has(block.type) &&
        block.props &&
        'url' in block.props &&
        typeof block.props.url === 'string' &&
        block.props.url.trim().length > 0
      ) {
        result.attachmentCount++;
      }
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);

  // Keywords — extract from already-parsed blocks (no re-parse)
  const fullText = getSearchableTextFromBlocks(blocks as unknown as Block[]);
  result.keywords = extractKeywords(fullText);
  result.expandable = blocks.length > 1;

  // Summary — find first non-checklist block with text content
  const summarySource =
    blocks.find(
      ({ type, content }) =>
        type !== 'checklistItem' &&
        Array.isArray(content) &&
        content.some((item) => 'text' in (item as Record<string, unknown>) && (item as { text: string }).text.trim()),
    ) || blocks[0];

  result.summaryLength = Array.isArray(summarySource.content)
    ? (summarySource.content as { text?: string }[]).reduce((len, item) => len + (item.text?.length ?? 0), 0)
    : 0;

  if (summarySource.type === 'checklistItem') {
    // Custom block types (e.g. checklistItem) aren't in the server schema — extract text directly
    result.summary = Array.isArray(summarySource.content)
      ? (summarySource.content as { text?: string }[]).map((item) => item.text ?? '').join('')
      : '';
  } else {
    const html = await editor.blocksToHTMLLossy([summarySource as unknown as Block]);
    result.summary = html.replace(/^<p[^>]*>(.*)<\/p>$/s, '$1');
  }

  return result;
};

/**
 * Removes attachments that are no longer referenced in the description.
 * Uses groupId on attachments to find all attachments belonging to an entity.
 * Accepts pre-parsed blocks to avoid redundant JSON.parse.
 */
export const removeAttachments = async (
  ctx: DbContext,
  { blocks, entityId, deletedBy }: { blocks: ParsedBlock[]; entityId: string; deletedBy: string },
) => {
  const { db } = ctx.var;
  // Get all existing attachments for this entity via groupId
  const attachments = await findAttachmentKeysByGroupId(ctx, { groupId: entityId });

  const fileBlocks = blocks.filter(({ type }) => mediaBlockTypes.has(type));

  const urls = fileBlocks
    .map(({ props }) => ('url' in props && typeof props.url === 'string' ? props.url : null))
    .filter((el) => el !== null);

  // Find attachments that are NOT in the description
  const attachmentsToRemove = attachments.filter(
    ({ convertedKey, originalKey }) =>
      !urls.some((url) => (convertedKey && url.includes(convertedKey)) || url.includes(originalKey)),
  );

  // Soft-delete unused attachments so the tombstones propagate to clients via delta sync
  if (attachmentsToRemove.length > 0) {
    const idsToRemove = attachmentsToRemove.map(({ id }) => id);
    if (idsToRemove.length) {
      const deletedAt = getIsoDate();
      await db
        .update(attachmentsTable)
        .set({ deletedAt, deletedBy, updatedAt: deletedAt, updatedBy: deletedBy })
        .where(and(inArray(attachmentsTable.id, idsToRemove), isNull(attachmentsTable.deletedAt)));
    }
  }
};
