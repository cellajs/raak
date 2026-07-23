import type { Block } from '@blocknote/core';
import { nanoid } from 'shared/utils/nanoid';
import type { attachmentsTable } from '#/modules/attachment/attachment-db';

export const formUrlBlock = (href: string, text: string, id?: string): Block => {
  return {
    id: id ?? nanoid(),
    type: 'paragraph',
    props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
    content: [{ type: 'link', href, content: [{ type: 'text', text, styles: {} }] }],
    children: [],
  };
};

export const formParagraphBlock = (text: string): Block => {
  return {
    id: nanoid(),
    type: 'paragraph',
    props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  };
};

export const formFileBlocks = async (attachments: (typeof attachmentsTable.$inferInsert & { id: string })[]) => {
  const result = await Promise.all(
    attachments.map(async ({ id, filename, originalKey, contentType }) => {
      const prefix = contentType.split('/')[0];
      const fileType = typeMap[prefix] ?? 'file';
      return [formFileBlock(id, fileType, filename, originalKey), formParagraphBlock('')];
    }),
  );

  // Flatten the nested arrays
  return result.flat() as Block[];
};

const typeMap: Record<string, 'audio' | 'image' | 'video' | 'file'> = {
  audio: 'audio',
  image: 'image',
  video: 'video',
};

const formFileBlock = (id: string, type: 'file' | 'image' | 'video' | 'audio', name: string, url: string) => ({
  id,
  type,
  props: {
    backgroundColor: 'default',
    name,
    url,
    // Attachment entity reference: feeds the derived task.attachments host array.
    attachmentId: id,
    caption: '',
    ...(type !== 'file' && { showPreview: true }),
    ...((type === 'video' || type === 'image') && {
      textAlignment: 'left',
      previewWidth: 512,
    }),
  },
  children: [],
});
