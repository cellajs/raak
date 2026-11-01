import type { TaskStatus } from '~/modules/task/task-properties';

interface PanelScroller {
  toStatus: (status: TaskStatus) => void;
  toTask: (taskId: string) => void;
}

// Task panels virtualize (virtua), so off-screen cards are not mounted: drags and the mobile create dialog ask the owning panels to scroll.
// Keyboard navigation goes through the board's panel nav registry.

const scrollers = new Map<string, Set<PanelScroller>>();

/** A Set per project, since a project page can mount several panels for one; each no-ops when its list lacks the band or task. Returns the unregister. */
export const registerPanelScroller = (projectId: string, scroller: PanelScroller) => {
  const projectScrollers = scrollers.get(projectId) ?? new Set();
  projectScrollers.add(scroller);
  scrollers.set(projectId, projectScrollers);
  return () => {
    projectScrollers.delete(scroller);
    if (projectScrollers.size === 0 && scrollers.get(projectId) === projectScrollers) scrollers.delete(projectId);
  };
};

/** Brings the `status` band into view in the panels owning `projectId`. */
export const scrollStatusIntoView = (projectId: string, status: TaskStatus) => {
  for (const scroller of scrollers.get(projectId) ?? []) scroller.toStatus(status);
};

/** Brings a task into view, and glows it, in the panels owning `projectId`. */
export const revealTask = (projectId: string, taskId: string) => {
  for (const scroller of scrollers.get(projectId) ?? []) scroller.toTask(taskId);
};
