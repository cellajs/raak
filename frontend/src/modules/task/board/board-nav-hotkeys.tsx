import { useHotkeys } from '~/hooks/use-hotkeys';
import type { HotkeyItem } from '~/hooks/use-hotkeys-helpers';
import { boardFocusStore } from '~/modules/task/board/board-focus-store';
import { focusItem } from '~/modules/task/helpers/focus-item';
import { findItemPanelId, getPanelNav } from '~/modules/task/helpers/panel-nav-registry';

// Buttons pass: a section bar is a list row, and ←/→ leave a panel from its header too. A control that uses an arrow
// itself, such as a reorder grip, prevents its default, and useHotkeys skips a prevented key.
const ignoreTags = ['INPUT', 'TEXTAREA', 'SELECT', '[role="grid"]'];

const currentItem = () => {
  const id = boardFocusStore.getState().currentItemId ?? document.activeElement?.id;
  if (!id) return null;
  const panelId = findItemPanelId(id);
  if (!panelId) return null;
  const items = getPanelNav(panelId)?.items() ?? [];
  return { id, panelId, items, index: items.findIndex((item) => item.id === id) };
};

// An item being edited keeps the arrow keys for its editor, and so does any control inside an item, a label tile's
// switch included; of the buttons, only a list row (a section bar) takes ↑/↓
const listContext = (event: KeyboardEvent) => {
  const current = currentItem();
  if (!current || current.index === -1) return null;
  const item = document.getElementById(current.id);
  if (item?.dataset.state === 'editing') return null;
  const target = event.target instanceof Element ? event.target : null;
  if (target !== item && item?.contains(target)) return null;
  const button = target?.closest('button');
  if (button && button.id !== current.id) return null;
  return current;
};

const direction = (event: KeyboardEvent) => (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1);

const step = (event: KeyboardEvent) => {
  const list = listContext(event);
  const target = list?.items[list.index + direction(event)];
  if (target) focusItem(target.id);
};

const toEdge = (event: KeyboardEvent) => {
  const list = listContext(event);
  const target = direction(event) === 1 ? list?.items.at(-1) : list?.items[0];
  if (target) focusItem(target.id);
};

// Groups appear in list order, so the next group is the next distinct group after the current item's. Nothing at the edges.
const toGroup = (event: KeyboardEvent) => {
  const list = listContext(event);
  if (!list) return;
  const groups = [...new Set(list.items.map((item) => item.group))];
  const targetGroup = groups[groups.indexOf(list.items[list.index].group) + direction(event)];
  if (targetGroup === undefined) return;
  const target = list.items.find((item) => item.group === targetGroup);
  if (target) focusItem(target.id);
};

// ←/→ start from the panel holding the focus, any control in it included, or with nothing focused from the current
// item's panel. Focus elsewhere (the board header, an open menu) keeps them.
const originPanelId = (event: KeyboardEvent) => {
  const target = event.target instanceof Element ? event.target : null;
  const panelId = target?.closest<HTMLElement>('[data-panel]')?.dataset.panel;
  if (panelId) return panelId;
  if (target && target !== document.body) return null;
  return currentItem()?.panelId;
};

// The item each panel was left on, to come back to while it is still in view
const leftOn = new Map<string, string>();

// Panels in board order, read from the layout. One without a mounted list (collapsed, the explainer) or without items is passed over.
const acrossPanels = (event: KeyboardEvent) => {
  const fromPanelId = originPanelId(event);
  if (fromPanelId === null) return;

  const panelIds = [...document.querySelectorAll<HTMLElement>('[data-panel]')].map((panel) => panel.dataset.panel ?? '');
  const step = direction(event);
  for (let index = panelIds.indexOf(fromPanelId ?? '') + step; index >= 0 && index < panelIds.length; index += step) {
    const nav = getPanelNav(panelIds[index]);
    const targetId = nav?.firstInView(leftOn.get(panelIds[index])) ?? nav?.items()[0]?.id;
    if (!targetId) continue;

    const current = currentItem();
    if (fromPanelId && current?.panelId === fromPanelId) leftOn.set(fromPanelId, current.id);
    focusItem(targetId);
    return;
  }
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
