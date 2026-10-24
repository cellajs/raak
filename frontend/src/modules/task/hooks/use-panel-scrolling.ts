import { autoScrollForElements, autoScrollWindowForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import type { VirtualizerHandle } from 'virtua';
import { useLatestRef } from '~/hooks/use-latest-ref';
import type { TogglableStatusType } from '~/modules/task/board/task-board-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getTargetIndexByStatus } from '~/modules/task/helpers/order-helpers';
import { firstItemInView, registerPanelNav } from '~/modules/task/helpers/panel-nav-registry';
import { registerPanelScroller } from '~/modules/task/helpers/panel-scroll-registry';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { TaskStatus } from '~/modules/task/task-properties';
import type { TaskProps } from '~/modules/task/types';

/** Auto-scrolls the viewport during drags, or the window when the page itself scrolls. */
function usePanelAutoScroll(scrollRef: RefObject<HTMLElement | null>, windowScroll: boolean) {
  useEffect(() => {
    if (!windowScroll && scrollRef.current) {
      return autoScrollForElements({ element: scrollRef.current, getAllowedAxis: () => 'vertical' });
    }
    return autoScrollWindowForElements({ getAllowedAxis: () => 'vertical' });
  }, [scrollRef, windowScroll]);
}

interface UsePanelScrollingOptions {
  projectId: string;
  /** The board panel showing these tasks: a project, or one split section of it. */
  panelId: string;
  tasks: TaskProps['task'][];
  isMobile: boolean;
  windowScroll: boolean;
}

/** Owns a task panel's scroll machinery so the panel component stays layout-only. */
export function usePanelScrolling({ projectId, panelId, tasks, isMobile, windowScroll }: UsePanelScrollingOptions) {
  const virtualizerRef = useRef<VirtualizerHandle>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  const tasksRef = useLatestRef(tasks);

  // Keyboard navigation reads the list in render order, statuses as groups, and brings virtualized-out cards into view
  useEffect(() => {
    return registerPanelNav(panelId, {
      items: () => tasksRef.current.map(({ id, status }) => ({ id, group: status })),
      scrollTo: (taskId) => {
        const index = tasksRef.current.findIndex((task) => task.id === taskId);
        if (index !== -1) virtualizerRef.current?.scrollToIndex(index, { align: 'nearest', smooth: false });
      },
      firstInView: () =>
        firstItemInView(
          tasksRef.current.map(({ id }) => id),
          scrollViewportRef.current,
        ),
    });
  }, [panelId]);

  // Both scrolls are instant: a smooth traversal mounts and measures every card on the way (see the iced-open note below).
  useEffect(() => {
    return registerPanelScroller(projectId, {
      // Skipped when a same-status card is visible: scrolling away from usable drop targets under a held drag would disorient.
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
      // The mobile create dialog's new task goes to its status, often off screen.
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

  usePanelAutoScroll(scrollViewportRef, isMobile || windowScroll);

  const icedBoundaryIndex = tasks.findIndex((task) => task.status === TaskStatus.Iced);

  const pendingScrollRef = useRef<{ action: 'accepted-open' | 'iced-open' } | { action: 'accepted-close'; anchorTaskId: string | null } | null>(null);

  const handleSectionToggle = (expanded: boolean, type: TogglableStatusType) => {
    if (type === 'iced') {
      if (expanded) pendingScrollRef.current = { action: 'iced-open' };
      return;
    }
    if (expanded) {
      pendingScrollRef.current = { action: 'accepted-open' };
      return;
    }
    // Collapse: anchor the first visible task so the view keeps its place; no anchor means the viewer was inside the folding block, so go to the top
    const virtualizer = virtualizerRef.current;
    const startIndex = virtualizer ? virtualizer.findItemIndex(virtualizer.scrollOffset) : -1;
    const anchor = tasksRef.current[startIndex];
    pendingScrollRef.current = { action: 'accepted-close', anchorTaskId: anchor && anchor.status !== TaskStatus.Accepted ? anchor.id : null };
  };

  const scrollToAndGlow = (index: number) => {
    virtualizerRef.current?.scrollToIndex(index, { align: 'center', smooth: false });
    const task = tasksRef.current[index];
    if (task) requestAnimationFrame(() => triggerTaskGlow(task.id));
  };

  // Runs after the tasks list updates, once the new boundary indices are available
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
      const anchorIndex = tasks.findIndex((task) => task.id === pending.anchorTaskId);
      if (anchorIndex >= 0) virtualizer.scrollToIndex(anchorIndex, { align: 'start', smooth: false });
      return;
    }

    if (pending.action === 'accepted-open') {
      // Mirrors iced-open: centering keeps the top half on accepted rows ('nearest' would park it behind the sticky accepted bar).
      // A frame later, for the virtualizer to lay out the added items; skipped when part of the block is in view.
      requestAnimationFrame(() => {
        const v = virtualizerRef.current;
        if (!v) return;
        const boundary = tasksRef.current.findIndex((task) => task.status !== TaskStatus.Accepted);
        const lastAccepted = boundary === -1 ? tasksRef.current.length - 1 : boundary - 1;
        if (lastAccepted < 0) return;
        if (v.findItemIndex(v.scrollOffset) <= lastAccepted) return;
        scrollToAndGlow(lastAccepted);
      });
      return;
    }

    // iced-open: jumps instantly so the virtualizer mounts only the destination window (a smooth traversal freezes the main thread on large lists).
    // Glows the first iced task; skipped when the boundary is in view.
    if (icedBoundaryIndex >= 0) {
      requestAnimationFrame(() => {
        const v = virtualizerRef.current;
        if (!v) return;
        if (v.findItemIndex(v.scrollOffset + v.viewportSize) >= icedBoundaryIndex) return;
        scrollToAndGlow(icedBoundaryIndex);
      });
    }
  }, [tasks, icedBoundaryIndex]);

  // Desktop: brings the create form into view when it opens or a status change moves it.
  // A frame later, because the virtualizer's offset can predate a scroll made just before (such as up to "+ Task").
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
