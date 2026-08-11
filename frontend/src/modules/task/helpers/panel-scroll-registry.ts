import type { TaskStatus } from '~/modules/task/task-properties';

type PanelScroller = (taskId: string) => void;
type PanelStatusScroller = (status: TaskStatus) => void;

/**
 * Per-panel scroll callbacks, keyed by projectId. Task panels use a virtualizer (virtua), so
 * cards outside the viewport are not mounted in the DOM; keyboard navigation and cross-project
 * drags ask the owning panel to scroll their target into view before the card exists.
 */
const scrollers = new Map<string, PanelScroller>();
const statusScrollers = new Map<string, Set<PanelStatusScroller>>();

/** Register a panel's scroller. Returns an unregister function for effect cleanup. */
export const registerPanelScroller = (projectId: string, scroller: PanelScroller) => {
  scrollers.set(projectId, scroller);
  return () => {
    // Only remove if still the same scroller (guards against unmount races on re-register).
    if (scrollers.get(projectId) === scroller) scrollers.delete(projectId);
  };
};

/** Ask the panel owning `projectId` to scroll `taskId` into view. No-op if the panel isn't registered. */
export const scrollTaskIntoView = (projectId: string, taskId: string) => {
  scrollers.get(projectId)?.(taskId);
};

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
