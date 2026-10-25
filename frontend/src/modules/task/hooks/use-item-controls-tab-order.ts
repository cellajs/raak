import { type RefObject, useEffect, useRef } from 'react';

const focusableSelector = 'a[href], button, textarea, input, select, [tabindex], [contenteditable="true"]';

interface ItemControlsTabOrderOptions {
  /** Tab and Shift+Tab cycle through the entered item and its controls; Escape is the way out. */
  trap?: boolean;
}

/**
 * Keeps a board item's own controls out of the Tab order until the item is entered, so a panel list is one Tab stop.
 * Escape inside an entered item returns focus to its main element.
 */
export function useItemControlsTabOrder(
  containerRef: RefObject<HTMLElement | null>,
  mainId: string,
  isEntered: boolean,
  { trap = false }: ItemControlsTabOrderOptions = {},
) {
  const removedRef = useRef(new Set<HTMLElement>());

  // Every render: a control can mount while the item stays out, such as a card's edit button once it is current
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isEntered) {
      for (const el of removedRef.current) el.setAttribute('tabindex', '0');
      removedRef.current.clear();
      return;
    }

    for (const el of container.querySelectorAll<HTMLElement>(focusableSelector)) {
      if (el.id === mainId || el.tabIndex < 0) continue;
      el.setAttribute('tabindex', '-1');
      removedRef.current.add(el);
    }
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!isEntered || !container) return;

    const cycleTab = (event: KeyboardEvent) => {
      // The editor owns Tab, for indenting
      if (event.defaultPrevented || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
      const main = document.getElementById(mainId);
      if (!main) return;
      const controls = [...container.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (el) => el !== main && el.tabIndex >= 0 && el.checkVisibility(),
      );
      const last = controls.at(-1);
      if (!last) return;
      const [from, to] = event.shiftKey ? [main, last] : [last, main];
      if (document.activeElement !== from) return;
      event.preventDefault();
      to.focus();
    };

    // Native, not React: React's synthetic event would also bubble in from menus portaled out of the item
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && trap) return cycleTab(event);
      if (event.key !== 'Escape') return;
      // A text field handles its own Escape (a rename cancels), and moving focus first would blur it into a commit
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const main = document.getElementById(mainId);
      if (!main || document.activeElement === main) return;
      main.focus();
      // Handled: the board's own Escape would act again on the item that now has focus
      event.preventDefault();
    };

    container.addEventListener('keydown', onKeyDown);
    return () => container.removeEventListener('keydown', onKeyDown);
  }, [isEntered, mainId, trap]);
}
