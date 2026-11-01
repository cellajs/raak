import { autoScrollForElements, autoScrollWindowForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element';
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { VirtualizerHandle } from 'virtua';
import { useLatestRef } from '~/hooks/use-latest-ref';
import type { TogglableStatusType } from '~/modules/task/board/task-board-store';
import { hasSectionBar, sectionBarId } from '~/modules/task/helpers/board-helpers';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getTargetIndexByStatus } from '~/modules/task/helpers/order-helpers';
import { firstItemInView, registerPanelNav } from '~/modules/task/helpers/panel-nav-registry';
import { registerPanelScroller } from '~/modules/task/helpers/panel-scroll-registry';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { TaskStatus } from '~/modules/task/task-properties';
import type { TaskCounts, TaskProps } from '~/modules/task/types';

/** Auto-scrolls the viewport during drags, or the window when the page itself scrolls. */
function usePanelAutoScroll(scrollRef: RefObject<HTMLElement | null>, windowScroll: boolean) {
  useEffect(() => {
    if (!windowScroll && scrollRef.current) {
      return autoScrollForElements({ element: scrollRef.current, getAllowedAxis: () => 'vertical' });
    }
    return autoScrollWindowForElements({ getAllowedAxis: () => 'vertical' });
  }, [scrollRef, windowScroll]);
}

// A card scrolled to mounts a render or two later, and a glow needs its element
const glowOnceMounted = (taskId: string, framesLeft = 10) => {
  if (document.getElementById(taskId)) return triggerTaskGlow(taskId);
  if (framesLeft > 0) requestAnimationFrame(() => glowOnceMounted(taskId, framesLeft - 1));
};

const sectionStatus: Record<TogglableStatusType, TaskStatus> = { accepted: TaskStatus.Accepted, iced: TaskStatus.Iced };

interface UsePanelScrollingOptions {
  projectId: string;
  panelId: string;
  tasks: TaskProps['task'][];
  counts: TaskCounts;
  isMobile: boolean;
  windowScroll: boolean;
}

/** Owns a task panel's scroll machinery so the panel component stays layout-only. */
export function usePanelScrolling({ projectId, panelId, tasks, counts, isMobile, windowScroll }: UsePanelScrollingOptions) {
  const virtualizerRef = useRef<VirtualizerHandle>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  const tasksRef = useLatestRef(tasks);
  const countsRef = useLatestRef(counts);

  // Keyboard navigation reads the list in render order, statuses as groups, and brings virtualized-out cards into view.
  // The two bars are its first and last rows.
  useEffect(() => {
    const sectionBar = (type: TogglableStatusType) =>
      hasSectionBar(type, countsRef.current) ? [{ id: sectionBarId(type, projectId), group: sectionStatus[type] }] : [];

    return registerPanelNav(panelId, {
      items: () => [...sectionBar('accepted'), ...tasksRef.current.map(({ id, status }) => ({ id, group: status })), ...sectionBar('iced')],
      scrollTo: (taskId) => {
        const index = tasksRef.current.findIndex((task) => task.id === taskId);
        if (index !== -1) virtualizerRef.current?.scrollToIndex(index, { align: 'nearest', smooth: false });
      },
      firstInView: (preferredId) =>
        firstItemInView(
          tasksRef.current.map(({ id }) => id),
          scrollViewportRef.current,
          preferredId,
        ),
    });
  }, [panelId, projectId]);

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
        requestAnimationFrame(() => glowOnceMounted(taskId));
      },
    });
  }, [projectId]);

  usePanelAutoScroll(scrollViewportRef, isMobile || windowScroll);

  // The top bar's rows come and go above the others, and virtua keeps measured heights by index: `shift` moves them with their rows
  // and holds the rows in view in place, so a collapse needs no scroll of its own. On for that one render only.
  const [shift, setShift] = useState(false);
  useLayoutEffect(() => {
    if (shift) setShift(false);
  }, [shift]);

  const pendingRevealRef = useRef<TogglableStatusType | null>(null);

  const handleSectionToggle = (expanded: boolean, type: TogglableStatusType) => {
    if (type === 'accepted') setShift(true);
    pendingRevealRef.current = expanded ? type : null;
  };

  // Always, wherever the view was: an "already in view" test cannot see the sticky bars covering the panel's edges.
  // Centred, so the card does not park behind one; instant, as a smooth traversal mounts and measures every card on the way.
  useLayoutEffect(() => {
    const type = pendingRevealRef.current;
    if (!type) return;
    pendingRevealRef.current = null;

    // A frame later, for the virtualizer to lay out the added rows
    requestAnimationFrame(() => {
      const tasks = tasksRef.current;
      const isTop = type === 'accepted';
      const matches = (task: TaskProps['task']) => task.status === sectionStatus[type];
      // The row next to the rest of the list
      const index = isTop ? tasks.findLastIndex(matches) : tasks.findIndex(matches);
      if (index === -1) {
        // Only older accepted tasks: their note opens under the bar, at that end of the list
        const viewport = scrollViewportRef.current;
        if (type === 'accepted') (viewport ?? window).scrollTo({ top: isTop ? 0 : (viewport ?? document.documentElement).scrollHeight });
        return;
      }
      virtualizerRef.current?.scrollToIndex(index, { align: 'center', smooth: false });
      requestAnimationFrame(() => glowOnceMounted(tasks[index].id));
    });
  }, [tasks]);

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

  return { virtualizerRef, scrollViewportRef, handleSectionToggle, shift };
}
