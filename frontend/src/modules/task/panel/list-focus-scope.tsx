import { type FocusEvent, type ReactNode, type RefObject, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { announce, prepareAnnouncement } from '~/modules/common/announce';
import { boardFocusStore, useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { focusItem } from '~/modules/task/helpers/focus-item';
import { firstItemInView } from '~/modules/task/helpers/panel-nav-registry';
import { cn } from '~/utils/cn';

interface ListFocusScopeProps {
  className?: string;
  /** DOM ids of the list's items, in render order. */
  itemIds: string[];
  /** The list's scroll viewport; absent while the window scrolls. */
  viewportRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

// Once per visit: the keys are the same in every list
let keysAnnounced = false;

/**
 * A board list as one Tab stop. A mounted current item holds it; otherwise the list does, and passes focus straight on
 * to its current item, or else to the first item in view, making that one current.
 */
export function ListFocusScope({ className, itemIds, viewportRef, children }: ListFocusScopeProps) {
  const { t } = useTranslation();
  const scopeRef = useRef<HTMLDivElement>(null);
  const ids = new Set(itemIds);
  const itemHoldsStop = useBoardFocusStore(
    (state) => !!state.mountedItemId && state.mountedItemId === state.currentItemId && ids.has(state.mountedItemId),
  );

  // A screen reader reads changes only to a live region it already knows
  useEffect(() => {
    if (scopeRef.current) prepareAnnouncement(scopeRef.current);
  }, []);

  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (!keysAnnounced) {
      keysAnnounced = true;
      announce(event.currentTarget, t('c:board_keys.hint'));
    }
    const { currentItemId } = boardFocusStore.getState();
    const targetId = currentItemId && ids.has(currentItemId) ? currentItemId : firstItemInView(itemIds, viewportRef.current);
    if (targetId) focusItem(targetId);
  };

  return (
    <div ref={scopeRef} className={cn('outline-none', className)} tabIndex={itemHoldsStop ? -1 : 0} onFocus={handleFocus}>
      {children}
    </div>
  );
}
