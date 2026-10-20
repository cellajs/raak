import type { TaskStatus } from '~/modules/task/task-properties';

type PanelStatusScroller = (status: TaskStatus) => void;

/**
 * Per-panel status-band scrollers, keyed by projectId. Task panels use a virtualizer (virtua), so cards outside the
 * viewport are not mounted in the DOM; cross-project drags ask the owning panels to bring a status band into view.
 * Keyboard navigation scrolls through the board's panel nav registry.
 */
const statusScrollers = new Map<string, Set<PanelStatusScroller>>();

/**
 * Register a panel's status scroller. A Set per projectId because split view mounts several
 * panels for one project; each scroller no-ops when its own list lacks the status band.
 * Returns an unregister function for effect cleanup.
 */
export const registerPanelStatusScroller = (projectId: string, scroller: PanelStatusScroller) => {
  const set = statusScrollers.get(projectId) ?? new Set();
  set.add(scroller);
  statusScrollers.set(projectId, set);
  return () => {
    set.delete(scroller);
    if (set.size === 0 && statusScrollers.get(projectId) === set) statusScrollers.delete(projectId);
  };
};

/** Ask the panels owning `projectId` to bring the `status` band into view. No-op if none registered. */
export const scrollStatusIntoView = (projectId: string, status: TaskStatus) => {
  const set = statusScrollers.get(projectId);
  if (!set) return;
  for (const scroller of set) scroller(status);
};
