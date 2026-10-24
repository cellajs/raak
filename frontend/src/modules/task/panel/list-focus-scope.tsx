import type { FocusEvent, ReactNode, RefObject } from 'react';
import { boardFocusStore, useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { focusItem } from '~/modules/task/helpers/focus-item';
import { firstItemInView } from '~/modules/task/helpers/panel-nav-registry';
import { cn } from '~/utils/cn';

interface ListFocusScopeProps {
  id?: string;
  className?: string;
  /** DOM ids of the list's items, in render order. */
  itemIds: string[];
  /** The list's scroll viewport; absent while the window scrolls. */
  viewportRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * A board list as one Tab stop. A mounted current item holds it; otherwise the list does, and passes focus straight on
 * to its current item, or else to the first item in view, making that one current.
 */
export function ListFocusScope({ id, className, itemIds, viewportRef, children }: ListFocusScopeProps) {
  const ids = new Set(itemIds);
  const itemHoldsStop = useBoardFocusStore(
    (state) => !!state.mountedItemId && state.mountedItemId === state.currentItemId && ids.has(state.mountedItemId),
  );

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const { currentItemId } = boardFocusStore.getState();
    const targetId = currentItemId && ids.has(currentItemId) ? currentItemId : firstItemInView(itemIds, viewportRef.current);
    if (targetId) focusItem(targetId);
  };

  return (
    <div id={id} className={cn('outline-none', className)} tabIndex={itemHoldsStop ? -1 : 0} onFocus={handleFocus}>
      {children}
    </div>
  );
}
