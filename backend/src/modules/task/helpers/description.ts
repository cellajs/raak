import type { Block } from '@blocknote/core';
import { getSearchableTextFromBlocks } from 'shared/blocknote';
import { deriveDocument } from 'shared/utils/derive-description-core';
import { validUuidSchema } from '#/schemas';
import { extractKeywords } from '#/utils/extract-keywords';

export type DerivedDescriptionProps = {
  summary: string;
  summaryLength: number;
  expandable: boolean;
  checkboxCount: number;
  checkedCount: number;
  /** Attachment entity ids referenced by media blocks; the owned-embedding host array. */
  attachments: string[];
  keywords: string;
};

/**
 * The columns a task stores from its description. Summary and counts come from the shared
 * `deriveDocument`, which the client's collaborative patch also runs. Keywords stay the full
 * deduplicated word list: server search matches only that column, and the shared derivation caps
 * its keywords at 900 characters. Attachment ids are narrowed to UUID shape for the uuid[] column.
 */
export const deriveDescriptionProps = (description: string | null | undefined): DerivedDescriptionProps => {
  const { summary, summaryLength, counts, blocks } = deriveDocument(description);
  // attachmentCount is a client-side presentation stat (attachments.length); the row persists none.
  const { attachmentCount: _attachmentCount, ...storedCounts } = counts;

  return {
    summary,
    summaryLength,
    ...storedCounts,
    attachments: storedCounts.attachments.filter((id) => validUuidSchema.safeParse(id).success),
    // DescriptionBlock is looser than @blocknote/core's Block union (custom block types).
    keywords: extractKeywords(getSearchableTextFromBlocks(blocks as unknown as Block[])),
  };
};
