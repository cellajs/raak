import type { Block } from '@blocknote/core';
import { ServerBlockNoteEditor } from '@blocknote/server-util';
import { serverBlockNoteSchema } from 'shared/utils/blocknote-server-schema';

// Reuse a single editor instance; schema construction is expensive, conversions are stateless.
const editor = ServerBlockNoteEditor.create({ schema: serverBlockNoteSchema });

export const getBlockFromMD = async (markdown: string): Promise<Block[]> => {
  return (await editor.tryParseMarkdownToBlocks(markdown)) as Block[];
};
