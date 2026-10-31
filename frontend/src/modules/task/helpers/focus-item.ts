import { boardFocusStore } from '~/modules/task/board/board-focus-store';
import { getPanelNav, scrollItemIntoView } from '~/modules/task/helpers/panel-nav-registry';

/** Makes an item the board's current one, or clears it, without moving DOM focus. */
export const setCurrentItem = (id: string | null) => boardFocusStore.getState().setCurrentItemId(id);

// One slot: a later keypress overwrites it, so an item that mounts late never takes focus from a newer one.
let pendingFocusId: string | null = null;

// virtua keeps a freshly mounted row hidden until it has measured it, and a hidden element ignores focus()
const focusOnceVisible = (id: string, item: HTMLElement) => {
  if (pendingFocusId !== id || !item.isConnected) return;
  if (boardFocusStore.getState().currentItemId !== id) {
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
  boardFocusStore.getState().setMountedItemId(id);
  return () => {
    const { mountedItemId, setMountedItemId } = boardFocusStore.getState();
    if (mountedItemId === id) setMountedItemId(null);
  };
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

/** Focuses where arrowing into a panel lands, once its list has replaced `placeholderId`: after expanding it. A split project lands in its first section. */
export const focusPanelOnceListed = (panelId: string, placeholderId: string, framesLeft = 60) => {
  const firstSection = document.querySelector<HTMLElement>(`[data-panel-group="${CSS.escape(panelId)}"] [data-panel]`);
  const nav = getPanelNav(firstSection?.dataset.panel ?? panelId);
  const targetId = nav?.firstInView() ?? nav?.items()[0]?.id;
  if (targetId && targetId !== placeholderId) return focusItem(targetId);
  if (framesLeft > 0) requestAnimationFrame(() => focusPanelOnceListed(panelId, placeholderId, framesLeft - 1));
};
