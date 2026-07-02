import type { Block } from '@blocknote/core';
import { ServerBlockNoteEditor } from '@blocknote/server-util';

// Reuse a single editor instance — schema construction is expensive, conversions are stateless
const editor = ServerBlockNoteEditor.create();

export const getBlockFromMD = async (markdown: string): Promise<Block[]> => {
  return (await editor.tryParseMarkdownToBlocks(markdown)) as Block[];
};
