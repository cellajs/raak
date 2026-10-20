import { useBoardFocusStore } from '~/modules/board-focus/board-focus-store';
import { scrollItemIntoView } from '~/modules/board-focus/panel-nav-registry';

/** Makes an item the board's current one, or clears it, without moving DOM focus. */
export const setCurrentItem = (id: string | null) => useBoardFocusStore.getState().setCurrentItemId(id);

// One slot: a later keypress overwrites it, so an item that mounts late never takes focus from a newer one.
let pendingFocusId: string | null = null;

// virtua keeps a freshly mounted row hidden until it has measured it, and a hidden element ignores focus()
const focusOnceVisible = (id: string, item: HTMLElement) => {
  if (pendingFocusId !== id || !item.isConnected) return;
  if (useBoardFocusStore.getState().currentItemId !== id) {
    pendingFocusId = null;
    return;
  }
  item.focus();
  if (document.activeElement === item) pendingFocusId = null;
  else requestAnimationFrame(() => focusOnceVisible(id, item));
};

/** Focuses a board item now, or as it mounts when virtualization or loading still holds it back. */
export const focusWhenMounted = (id: string) => {
  pendingFocusId = id;
  const item = document.getElementById(id);
  if (item) focusOnceVisible(id, item);
};

/** Called by a board item as it mounts, to take the focus left for it while it was not mounted. */
export const takePendingFocus = (id: string, item: HTMLElement | null) => {
  if (item && pendingFocusId === id) focusOnceVisible(id, item);
};

/** Records the current item as mounted. Returns the cleanup that clears it, unless a newer item took its place. */
export const markCurrentItemMounted = (id: string) => {
  useBoardFocusStore.getState().setMountedItemId(id);
  return () => {
    const { mountedItemId, setMountedItemId } = useBoardFocusStore.getState();
    if (mountedItemId === id) setMountedItemId(null);
  };
};

/** Makes an item current and scrolls it into view, leaving DOM focus where it is: stepping from the search box. */
export const revealItem = (id: string) => {
  setCurrentItem(id);
  scrollItemIntoView(id);
};

/** Makes an item current and focuses it, scrolling it into view first when its panel virtualized it out. */
export const focusItem = (id: string) => {
  setCurrentItem(id);

  if (!document.getElementById(id)) {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    scrollItemIntoView(id);
  }
  focusWhenMounted(id);
};
