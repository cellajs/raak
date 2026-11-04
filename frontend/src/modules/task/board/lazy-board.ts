import { lazy } from 'react';
import { preloadLazyComponent } from '~/hooks/use-preload-lazy-components';
import { BlockNoteFullHtml } from '~/modules/common/blocknote/lazy-full-html';

/** The board, loaded together with the static renderer of its card titles: a title still loading would paint after its card, which then grows. */
export const Board = lazy(async () => {
  const [{ Board: board }] = await Promise.all([import('~/modules/task/board/task-board'), preloadLazyComponent(BlockNoteFullHtml)]);
  return { default: board };
});
