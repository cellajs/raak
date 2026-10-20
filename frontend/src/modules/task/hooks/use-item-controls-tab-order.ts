import { type RefObject, useEffect, useRef } from 'react';

const focusableSelector = 'a[href], button, textarea, input, select, [tabindex], [contenteditable="true"]';

/**
 * Keeps a board item's own controls (task card, create form) out of the Tab order until the item is current, so a panel
 * list is one Tab stop and Tab leaves it after the current item's controls. Escape inside a current item returns focus to
 * its main element.
 */
export function useItemControlsTabOrder(containerRef: RefObject<HTMLElement | null>, mainId: string, isCurrent: boolean) {
  const removedRef = useRef(new Set<HTMLElement>());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isCurrent) {
      for (const el of removedRef.current) el.setAttribute('tabindex', '0');
      removedRef.current.clear();
      return;
    }

    for (const el of container.querySelectorAll<HTMLElement>(focusableSelector)) {
      if (el.id === mainId || el.tabIndex < 0) continue;
      el.setAttribute('tabindex', '-1');
      removedRef.current.add(el);
    }
  }, [isCurrent, mainId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!isCurrent || !container) return;

    // Native, not React: React's synthetic event would also bubble in from menus portaled out of the item
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const main = document.getElementById(mainId);
      if (main && document.activeElement !== main) main.focus();
    };

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [isCurrent, mainId]);
}
