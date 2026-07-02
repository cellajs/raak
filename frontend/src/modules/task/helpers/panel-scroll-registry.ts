/**
 * Registry of per-panel "scroll a task into view" callbacks.
 *
 * Task panels use a virtualizer (virtua), so cards outside the current viewport are not mounted in the DOM.
 * Keyboard navigation may target such a task; focusing it requires scrolling it into view first so virtua
 * mounts the card. Each panel registers a scroller keyed by its projectId; `scrollTaskIntoView` invokes it.
 */
type PanelScroller = (taskId: string) => void;

const scrollers = new Map<string, PanelScroller>();

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
