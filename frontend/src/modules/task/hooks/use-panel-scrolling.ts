import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { VirtualizerHandle } from 'virtua';
import type { TogglableStatusType } from '~/modules/task/board/task-board-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getTargetIndexByStatus } from '~/modules/task/helpers/order-helpers';
import { registerPanelScroller, registerPanelStatusScroller } from '~/modules/task/helpers/panel-scroll-registry';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { usePanelAutoScroll } from '~/modules/task/hooks/use-panel-drop-target';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskStatus } from '~/modules/task/task-properties';
import type { TaskProps } from '~/modules/task/types';

interface UsePanelScrollingOptions {
  projectId: string;
  tasks: TaskProps['task'][];
  isMobile: boolean;
  windowScroll: boolean;
}

/**
 * Owns all of a task panel's scroll machinery so the panel component stays layout-only:
 * the virtualizer/viewport refs, the keyboard-nav scroller registration, drag auto-scroll,
 * status-section visibility, the section-toggle pending scroll, and the desktop create-form /
 * mobile new-task scroll-into-view effects. Effect order is kept identical to the previous
 * inline version.
 */
export function usePanelScrolling({ projectId, tasks, isMobile, windowScroll }: UsePanelScrollingOptions) {
  // Use ref for focusedTaskId so the mobile scroll effect can read it without
  // causing ALL panels to re-render on every focus change.
  const focusedTaskIdRef = useRef(useTaskInteractionStore.getState().focusedTaskId);
  useEffect(
    () =>
      useTaskInteractionStore.subscribe((s) => {
        focusedTaskIdRef.current = s.focusedTaskId;
      }),
    [],
  );

  const virtualizerRef = useRef<VirtualizerHandle>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const initialLength = useRef(tasks.length);

  // Keep the latest tasks in a ref so the registered scroller always resolves the current index.
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  // Register a scroller so keyboard navigation can bring virtualized-out tasks into view before focusing.
  useEffect(() => {
    return registerPanelScroller(projectId, (taskId) => {
      const index = tasksRef.current.findIndex((t) => t.id === taskId);
      if (index === -1) return;
      virtualizerRef.current?.scrollToIndex(index, { align: 'nearest', smooth: false });
    });
  }, [projectId]);

  // Register a status scroller so a cross-project drag can bring the source-status band into
  // view, giving the drag between-card drop targets. Skips when any same-status card is already
  // visible: scrolling away from usable drop targets under a held drag would disorient.
  // Instant scroll: a smooth traversal mounts and measures every card along the way (see the
  // iced-open note below).
  useEffect(() => {
    return registerPanelStatusScroller(projectId, (status) => {
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
  const pendingScrollRef = useRef<
    { action: 'accepted-open' | 'iced-open' } | { action: 'accepted-close'; anchorTaskId: string | null } | null
  >(null);

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
    pendingScrollRef.current = {
      action: 'accepted-close',
      anchorTaskId: anchor && anchor.status !== TaskStatus.Accepted ? anchor.id : null,
    };
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

  const handleCreateFormPosition = useCallback(
    (targetStatus = TaskStatus.Unstarted) => {
      const targetIndex = getTargetIndexByStatus(tasks, targetStatus);

      // No scrollViewportRef requirement: in windowScroll mode the ref is never attached,
      // and the WindowVirtualizer handle supports the same offset/index/scroll API.
      const virtualizer = virtualizerRef.current;
      if (!virtualizer || targetIndex === -1) return;

      // Check visibility of target index
      const startIndex = virtualizerRef.current?.findItemIndex(virtualizerRef.current.scrollOffset) ?? 0;
      const endIndex =
        virtualizerRef.current?.findItemIndex(
          virtualizerRef.current.scrollOffset + virtualizerRef.current.viewportSize,
        ) ?? 0;
      const targetIndexVisible = targetIndex > startIndex && targetIndex < endIndex;

      if (targetIndexVisible) return;
      // Scroll to target index
      virtualizer.scrollToIndex(targetIndex, { align: 'center', smooth: false });
    },
    [tasks],
  );

  // Desktop: scroll to create task form when it appears
  useEffect(() => {
    if (isMobile) return;
    const createForm = tasks.find((t) => isDraftTask(t));
    if (!createForm) return;

    handleCreateFormPosition(createForm.status);
  }, [tasks]);

  // Mobile: scroll to focused task when a new task is added
  useEffect(() => {
    const focusedTaskId = focusedTaskIdRef.current;
    if (!isMobile || !focusedTaskId || initialLength.current === tasks.length) return;
    const targetIndex = tasks.findIndex(({ id }) => id === focusedTaskId);

    if (targetIndex <= 0) return;
    const startIndex = virtualizerRef.current?.findItemIndex(virtualizerRef.current.scrollOffset) ?? 0;
    const endIndex =
      virtualizerRef.current?.findItemIndex(
        virtualizerRef.current.scrollOffset + virtualizerRef.current.viewportSize,
      ) ?? 0;
    const targetIndexVisible = targetIndex >= startIndex && targetIndex <= endIndex;

    if (!targetIndexVisible) {
      virtualizerRef.current?.scrollToIndex(targetIndex, { smooth: false, align: 'center' });
      requestAnimationFrame(() => triggerTaskGlow(focusedTaskId));
    }
    initialLength.current++;
  }, [tasks.length]);

  return { virtualizerRef, scrollViewportRef, handleSectionToggle };
}
