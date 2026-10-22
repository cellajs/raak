import type { TaskStatus } from '~/modules/task/task-properties';

interface PanelScroller {
  toStatus: (status: TaskStatus) => void;
  toTask: (taskId: string) => void;
}

/**
 * Per-panel scrollers, keyed by projectId. Task panels use a virtualizer (virtua), so cards outside the viewport are not
 * mounted in the DOM; cross-project drags ask the owning panels to bring a status band into view, the mobile create
 * dialog a new task. Keyboard navigation scrolls through the board's panel nav registry.
 */
const scrollers = new Map<string, Set<PanelScroller>>();

/**
 * Register a panel's scroller. A Set per projectId because split view mounts several
 * panels for one project; each scroller no-ops when its own list lacks the status band or task.
 * Returns an unregister function for effect cleanup.
 */
export const registerPanelScroller = (projectId: string, scroller: PanelScroller) => {
  const set = scrollers.get(projectId) ?? new Set();
  set.add(scroller);
  scrollers.set(projectId, set);
  return () => {
    set.delete(scroller);
    if (set.size === 0 && scrollers.get(projectId) === set) scrollers.delete(projectId);
  };
};

/** Ask the panels owning `projectId` to bring the `status` band into view. No-op if none registered. */
export const scrollStatusIntoView = (projectId: string, status: TaskStatus) => {
  for (const scroller of scrollers.get(projectId) ?? []) scroller.toStatus(status);
};

/** Ask the panels owning `projectId` to bring a task into view and glow it. No-op if none registered. */
export const revealTask = (projectId: string, taskId: string) => {
  for (const scroller of scrollers.get(projectId) ?? []) scroller.toTask(taskId);
};
