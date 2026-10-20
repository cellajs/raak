/** An item of a panel list, in render order. `group` marks a run the board can jump across (a task's status). */
export interface PanelNavItem {
  id: string;
  group?: string | number;
}

interface PanelNav {
  items: () => PanelNavItem[];
  /** Brings an item into view, mounting it first when the list virtualizes. */
  scrollTo: (id: string) => void;
  /** The first item at least partly in view, where arrowing into the panel lands. */
  firstInView: () => string | undefined;
}

/**
 * Board panels that hold a list of items, keyed by panel id. A panel registers while its list is mounted, so a
 * collapsed panel drops out of keyboard navigation by itself.
 */
const panels = new Map<string, PanelNav>();

/** Registers a panel list. Returns an unregister function for effect cleanup. */
export const registerPanelNav = (panelId: string, nav: PanelNav) => {
  panels.set(panelId, nav);
  return () => {
    if (panels.get(panelId) === nav) panels.delete(panelId);
  };
};

export const getPanelNav = (panelId: string) => panels.get(panelId);

/** The id of the panel whose list holds `itemId`. */
export const findItemPanelId = (itemId: string) => {
  for (const [panelId, nav] of panels) if (nav.items().some(({ id }) => id === itemId)) return panelId;
};

/** Asks the panel holding `itemId` to bring it into view. No-op when no registered panel holds it. */
export const scrollItemIntoView = (itemId: string) => {
  const panelId = findItemPanelId(itemId);
  if (panelId) panels.get(panelId)?.scrollTo(itemId);
};

/** The first of `ids` whose element reaches below `top`, else the first id. Unmounted ids are skipped. */
export const firstItemInView = (ids: string[], viewport: HTMLElement | null) => {
  const top = viewport?.getBoundingClientRect().top ?? 0;
  for (const id of ids) {
    const item = document.getElementById(id);
    if (item && item.getBoundingClientRect().bottom > top + 1) return id;
  }
  return ids[0];
};
