import { useHotkeys } from '~/hooks/use-hotkeys';
import type { HotkeyItem } from '~/hooks/use-hotkeys-helpers';
import { boardFocusStore } from '~/modules/board-focus/board-focus-store';
import { focusItem } from '~/modules/board-focus/focus-item';
import { findItemPanelId, getPanelNav } from '~/modules/board-focus/panel-nav-registry';

const ignoreTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', '[role="grid"]'];

const currentItem = () => {
  const id = boardFocusStore.getState().currentItemId ?? document.activeElement?.id;
  if (!id) return null;
  const panelId = findItemPanelId(id);
  if (!panelId) return null;
  const items = getPanelNav(panelId)?.items() ?? [];
  return { id, panelId, items, index: items.findIndex((item) => item.id === id) };
};

// An item being edited keeps the arrow keys for its editor
const listContext = () => {
  const current = currentItem();
  if (!current || current.index === -1) return null;
  if (document.getElementById(current.id)?.dataset.state === 'editing') return null;
  return current;
};

const direction = (event: KeyboardEvent) => (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1);

const step = (event: KeyboardEvent) => {
  const list = listContext();
  const target = list?.items[list.index + direction(event)];
  if (target) focusItem(target.id);
};

const toEdge = (event: KeyboardEvent) => {
  const list = listContext();
  const target = direction(event) === 1 ? list?.items.at(-1) : list?.items[0];
  if (target) focusItem(target.id);
};

// Groups appear in list order, so the next group is the next distinct group after the current item's. Nothing at the edges.
const toGroup = (event: KeyboardEvent) => {
  const list = listContext();
  if (!list) return;
  const groups = [...new Set(list.items.map((item) => item.group))];
  const targetGroup = groups[groups.indexOf(list.items[list.index].group) + direction(event)];
  if (targetGroup === undefined) return;
  const target = list.items.find((item) => item.group === targetGroup);
  if (target) focusItem(target.id);
};

// Panels in board order, read from the layout: only those whose list is mounted have registered
const acrossPanels = (event: KeyboardEvent) => {
  const panelIds = [...document.querySelectorAll<HTMLElement>('[data-panel]')]
    .map((panel) => panel.getAttribute('data-panel'))
    .filter((panelId): panelId is string => !!panelId && !!getPanelNav(panelId));
  const currentIndex = panelIds.indexOf(currentItem()?.panelId ?? '');
  const nextNav = getPanelNav(panelIds[currentIndex + direction(event)] ?? '');
  const targetId = nextNav?.firstInView() ?? nextNav?.items()[0]?.id;
  if (targetId) focusItem(targetId);
};

const hotkeys: HotkeyItem[] = [
  ['ArrowDown', step],
  ['ArrowUp', step],
  ['meta + ArrowDown', toEdge],
  ['meta + ArrowUp', toEdge],
  ['alt + ArrowDown', toGroup],
  ['alt + ArrowUp', toGroup],
  ['ArrowRight', acrossPanels],
  ['ArrowLeft', acrossPanels],
];

const noHotkeys: HotkeyItem[] = [];

/** Arrow keys across the board's panel lists: ↑/↓ within a list, ⌘ to its ends, ⌥ across groups, ←/→ across panels. */
export function BoardNavHotkeys({ disabled }: { disabled?: boolean }) {
  useHotkeys(disabled ? noHotkeys : hotkeys, ignoreTags);
  return null;
}
