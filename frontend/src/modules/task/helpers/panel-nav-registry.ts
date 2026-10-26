/** An item of a panel list, in render order. `group` marks a run the board can jump across (a task's status). */
export interface PanelNavItem {
  id: string;
  group?: string | number;
}

interface PanelNav {
  items: () => PanelNavItem[];
  /** Brings an item into view, mounting it first when the list virtualizes. */
  scrollTo: (id: string) => void;
  /** Where arrowing into the panel lands: `preferredId` while it is in view, else the first item at least partly in view. */
  firstInView: (preferredId?: string) => string | undefined;
}

/** Panel lists by panel id. A panel registers while its list is mounted, so a collapsed one drops out of keyboard navigation. */
const panels = new Map<string, PanelNav>();

/** Registers a panel list. Returns an unregister function for effect cleanup. */
export const registerPanelNav = (panelId: string, nav: PanelNav) => {
  panels.set(panelId, nav);
  return () => {
    if (panels.get(panelId) === nav) panels.delete(panelId);
  };
};

export const getPanelNav = (panelId: string) => panels.get(panelId);

export const findItemPanelId = (itemId: string) => {
  for (const [panelId, nav] of panels) if (nav.items().some(({ id }) => id === itemId)) return panelId;
};

/** No-op when no registered panel holds the item. */
export const scrollItemIntoView = (itemId: string) => {
  const panelId = findItemPanelId(itemId);
  if (panelId) panels.get(panelId)?.scrollTo(itemId);
};

/** `preferredId` while it is in view, else the first of `ids` whose element reaches below `top`, else the first id. Unmounted ids are skipped. */
export const firstItemInView = (ids: string[], viewport: HTMLElement | null, preferredId?: string) => {
  const { top, bottom } = viewport?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
  const preferred = preferredId && ids.includes(preferredId) ? document.getElementById(preferredId)?.getBoundingClientRect() : undefined;
  if (preferred && preferred.bottom > top + 1 && preferred.top < bottom - 1) return preferredId;
  for (const id of ids) {
    const item = document.getElementById(id);
    if (item && item.getBoundingClientRect().bottom > top + 1) return id;
  }
  return ids[0];
};
