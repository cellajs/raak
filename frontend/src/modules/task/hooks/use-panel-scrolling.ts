import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { VirtualizerHandle } from 'virtua';
import { firstItemInView, registerPanelNav } from '~/modules/board-focus/panel-nav-registry';
import type { TogglableStatusType } from '~/modules/task/board/task-board-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getTargetIndexByStatus } from '~/modules/task/helpers/order-helpers';
import { registerPanelScroller } from '~/modules/task/helpers/panel-scroll-registry';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { usePanelAutoScroll } from '~/modules/task/hooks/use-panel-drop-target';
import { TaskStatus } from '~/modules/task/task-properties';
import type { TaskProps } from '~/modules/task/types';

interface UsePanelScrollingOptions {
  projectId: string;
  /** The board panel showing these tasks: a project, or one split section of it. */
  panelId: string;
  tasks: TaskProps['task'][];
  isMobile: boolean;
  windowScroll: boolean;
}

/**
 * Owns all of a task panel's scroll machinery so the panel component stays layout-only:
 * the virtualizer/viewport refs, the keyboard-nav and status/task scroller registrations, drag
 * auto-scroll, status-section visibility, the section-toggle pending scroll, and the desktop
 * create-form scroll-into-view effect.
 */
export function usePanelScrolling({ projectId, panelId, tasks, isMobile, windowScroll }: UsePanelScrollingOptions) {
  const virtualizerRef = useRef<VirtualizerHandle>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest tasks in a ref so the registered scroller always resolves the current index.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Keyboard navigation reads the list in render order, statuses as groups, and brings virtualized-out cards into view
  useEffect(() => {
    return registerPanelNav(panelId, {
      items: () => tasksRef.current.map(({ id, status }) => ({ id, group: status })),
      scrollTo: (taskId) => {
        const index = tasksRef.current.findIndex((t) => t.id === taskId);
        if (index !== -1) virtualizerRef.current?.scrollToIndex(index, { align: 'nearest', smooth: false });
      },
      firstInView: () =>
        firstItemInView(
          tasksRef.current.map(({ id }) => id),
          scrollViewportRef.current,
        ),
    });
  }, [panelId]);

  // A cross-project drag brings the source-status band into view, giving the drag between-card drop targets. It skips
  // when any same-status card is already visible: scrolling away from usable drop targets under a held drag would
  // disorient. The mobile create dialog brings the new task into view, since it lands at its status, often off screen.
  // Instant scroll: a smooth traversal mounts and measures every card along the way (see the iced-open note below).
  useEffect(() => {
    return registerPanelScroller(projectId, {
      toStatus: (status) => {
        const virtualizer = virtualizerRef.current;
        if (!virtualizer) return;
        const tasks = tasksRef.current;
        const targetIndex = getTargetIndexByStatus(tasks, status);
        if (targetIndex === -1) return;

        const startIndex = virtualizer.findItemIndex(virtualizer.scrollOffset);
        const endIndex = virtualizer.findItemIndex(virtualizer.scrollOffset + virtualizer.viewportSize);
        for (let i = Math.max(0, startIndex); i <= endIndex && i < tasks.length; i++) {
          if (tasks[i].status === status && !isDraftTask(tasks[i])) return;
        }

        virtualizer.scrollToIndex(targetIndex, { align: 'center', smooth: false });
      },
      toTask: (taskId) => {
        const virtualizer = virtualizerRef.current;
        const index = tasksRef.current.findIndex(({ id }) => id === taskId);
        if (!virtualizer || index === -1) return;

        // A card on an edge can sit under the sticky header or the floating nav, so only one strictly inside counts as visible
        const startIndex = virtualizer.findItemIndex(virtualizer.scrollOffset);
        const endIndex = virtualizer.findItemIndex(virtualizer.scrollOffset + virtualizer.viewportSize);
        if (index <= startIndex || index >= endIndex) virtualizer.scrollToIndex(index, { align: 'center', smooth: false });
        requestAnimationFrame(() => triggerTaskGlow(taskId));
      },
    });
  }, [projectId]);

  // Auto-scroll the panel's scroll viewport during drag operations.
  // No-op when scrollViewportRef is unattached (mobile / windowScroll branches).
  // The drop target itself is registered one level up in `board-panel.tsx`
  // so it remains live when the panel is collapsed.
  usePanelAutoScroll(scrollViewportRef, isMobile || windowScroll);

  // Index of the first iced task in the sorted list, used by the section-toggle scroll below
  const icedBoundaryIndex = useMemo(() => tasks.findIndex((t) => t.status === TaskStatus.Iced), [tasks]);

  // Pending scroll action set by section toggle, consumed by the effect below
  const pendingScrollRef = useRef<{ action: 'accepted-open' | 'iced-open' } | { action: 'accepted-close'; anchorTaskId: string | null } | null>(null);

  const handleSectionToggle = useCallback((expanded: boolean, type: TogglableStatusType) => {
    if (type === 'iced') {
      if (expanded) pendingScrollRef.current = { action: 'iced-open' };
      return;
    }
    if (expanded) {
      pendingScrollRef.current = { action: 'accepted-open' };
      return;
    }
    // Collapse: anchor the first visible task so the view keeps its place when the
    // accepted block above folds away. A null anchor means the viewer was inside the
    // accepted block itself, whose content is about to disappear: return to the top.
    const virtualizer = virtualizerRef.current;
    const startIndex = virtualizer ? virtualizer.findItemIndex(virtualizer.scrollOffset) : -1;
    const anchor = tasksRef.current[startIndex];
    pendingScrollRef.current = { action: 'accepted-close', anchorTaskId: anchor && anchor.status !== TaskStatus.Accepted ? anchor.id : null };
  }, []);

  // Execute pending scroll after the tasks list updates (new boundary indices are available)
  useLayoutEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = null;

    const virtualizer = virtualizerRef.current;
    if (!virtualizer) return;

    if (pending.action === 'accepted-close') {
      if (!pending.anchorTaskId) {
        (scrollViewportRef.current ?? window).scrollTo({ top: 0 });
        return;
      }
      const anchorIndex = tasks.findIndex((t) => t.id === pending.anchorTaskId);
      if (anchorIndex >= 0) virtualizer.scrollToIndex(anchorIndex, { align: 'start', smooth: false });
      return;
    }

    if (pending.action === 'accepted-open') {
      // Mirror iced-open: center the boundary (last accepted) so the top half of the viewport
      // shows accepted tasks, and glow it to preserve orientation. An 'align: nearest' nudge
      // would park the row at the top edge, hidden behind the sticky accepted bar. Wait one
      // frame for the virtualizer to lay out the newly-added items; skip when part of the
      // accepted block is already in view.
      requestAnimationFrame(() => {
        const v = virtualizerRef.current;
        if (!v) return;
        const boundary = tasksRef.current.findIndex((t) => t.status !== TaskStatus.Accepted);
        const lastAccepted = boundary === -1 ? tasksRef.current.length - 1 : boundary - 1;
        if (lastAccepted < 0) return;
        if (v.findItemIndex(v.scrollOffset) <= lastAccepted) return;
        v.scrollToIndex(lastAccepted, { align: 'center', smooth: false });
        const acceptedTask = tasksRef.current[lastAccepted];
        if (acceptedTask) requestAnimationFrame(() => triggerTaskGlow(acceptedTask.id));
      });
      return;
    }

    // iced-open: jump instantly so the virtualizer mounts only the destination window
    // (a smooth traversal would mount and measure every card along the way, freezing
    // the main thread for seconds on large lists), and glow the first iced task to
    // preserve orientation. Skip when the iced boundary is already in view.
    if (icedBoundaryIndex >= 0) {
      requestAnimationFrame(() => {
        const v = virtualizerRef.current;
        if (!v) return;
        if (v.findItemIndex(v.scrollOffset + v.viewportSize) >= icedBoundaryIndex) return;
        v.scrollToIndex(icedBoundaryIndex, { align: 'center', smooth: false });
        const icedTask = tasksRef.current[icedBoundaryIndex];
        if (icedTask) requestAnimationFrame(() => triggerTaskGlow(icedTask.id));
      });
    }
  }, [tasks, icedBoundaryIndex]);

  // Desktop: bring the create form into view when it opens or a status change moves it, not on every list change.
  // A frame later, because the virtualizer's offset can still predate a scroll made just before, such as one up to "+ Task".
  const draftTask = tasks.find(isDraftTask);
  const draftPlacement = draftTask ? `${draftTask.status}:${draftTask.displayOrder}` : null;
  useEffect(() => {
    if (isMobile || !draftPlacement) return;
    const frame = requestAnimationFrame(() => {
      const index = tasksRef.current.findIndex(isDraftTask);
      if (index !== -1) virtualizerRef.current?.scrollToIndex(index, { align: 'nearest', smooth: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [draftPlacement]);

  return { virtualizerRef, scrollViewportRef, handleSectionToggle };
}
