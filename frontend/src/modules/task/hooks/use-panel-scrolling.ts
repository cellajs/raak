import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { VirtualizerHandle } from 'virtua';
import { defaultPanelPrefs, type TogglableStatusType, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getTargetIndexByStatus } from '~/modules/task/helpers/order-helpers';
import { registerPanelScroller } from '~/modules/task/helpers/panel-scroll-registry';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { usePanelAutoScroll } from '~/modules/task/hooks/use-panel-drop-target';
import { useStatusSectionSticky } from '~/modules/task/hooks/use-status-section-sticky';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskStatus } from '~/modules/task/task-properties';
import type { TaskProps } from '~/modules/task/types';

interface UsePanelScrollingOptions {
  projectId: string;
  boardId: string;
  tasks: TaskProps['task'][];
  isMobile: boolean;
  windowScroll: boolean;
}

/**
 * Owns all of a task panel's scroll machinery so the panel component stays layout-only:
 * the virtualizer/viewport refs, the keyboard-nav scroller registration, drag auto-scroll,
 * status-section stickiness, the section-toggle pending scroll, and the desktop create-form /
 * mobile new-task scroll-into-view effects. Effect order is kept identical to the previous
 * inline version.
 */
export function usePanelScrolling({ projectId, boardId, tasks, isMobile, windowScroll }: UsePanelScrollingOptions) {
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

  // Auto-scroll the panel's scroll viewport during drag operations.
  // No-op when scrollViewportRef is unattached (mobile / windowScroll branches).
  // The drop target itself is registered one level up in `board-panel.tsx`
  // so it remains live when the panel is collapsed.
  usePanelAutoScroll(scrollViewportRef, isMobile || windowScroll);

  // Compute boundary indices for accepted/iced task groups in the sorted list
  const { acceptedBoundaryIndex, icedBoundaryIndex } = useMemo(() => {
    let acceptedIdx = -1;
    let icedIdx = -1;
    for (let i = 0; i < tasks.length; i++) {
      if (acceptedIdx === -1 && tasks[i].status !== TaskStatus.Accepted) {
        acceptedIdx = i;
      }
      if (tasks[i].status === TaskStatus.Iced) {
        icedIdx = i;
        break;
      }
    }
    if (acceptedIdx === -1 && tasks.some((t) => t.status === TaskStatus.Accepted)) {
      acceptedIdx = tasks.length;
    }
    return { acceptedBoundaryIndex: acceptedIdx, icedBoundaryIndex: icedIdx };
  }, [tasks]);

  // Track status section sticky state via virtualizer visible range
  const { expandAccepted, expandIced } = useTaskBoardStore(
    (state) => state.panelData[boardId]?.[projectId]?.prefs || defaultPanelPrefs,
  );
  const { stickyAccepted, stickyIced } = useStatusSectionSticky({
    enabled: true,
    scrollRef: scrollViewportRef,
    virtualizerRef,
    acceptedBoundaryIndex,
    icedBoundaryIndex,
    expandedAccepted: expandAccepted,
    expandedIced: expandIced,
  });

  // Pending scroll action set by section toggle, consumed by the effect below
  const pendingScrollRef = useRef<'accepted-close' | 'iced-open' | null>(null);

  const handleSectionToggle = useCallback((expanded: boolean, type: TogglableStatusType) => {
    if (type === 'accepted' && !expanded) pendingScrollRef.current = 'accepted-close';
    else if (type === 'iced' && expanded) pendingScrollRef.current = 'iced-open';
  }, []);

  // Execute pending scroll after tasks list updates (new boundary indices are available)
  useLayoutEffect(() => {
    const action = pendingScrollRef.current;
    if (!action) return;
    pendingScrollRef.current = null;

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    if (action === 'accepted-close') {
      viewport.scrollTo({ top: 0 });
    } else if (action === 'iced-open' && icedBoundaryIndex >= 0) {
      // Wait one frame for virtualizer to lay out the newly-added iced items
      requestAnimationFrame(() => {
        virtualizerRef.current?.scrollToIndex(icedBoundaryIndex, { align: 'center', smooth: true });
      });
    }
  }, [tasks, icedBoundaryIndex]);

  const handleCreateFormPosition = useCallback(
    (targetStatus = TaskStatus.Unstarted) => {
      const targetIndex = getTargetIndexByStatus(tasks, targetStatus);

      const virtualizer = virtualizerRef.current;
      const scrollViewport = scrollViewportRef.current;
      // Ensure targetIndex, virtualizer and scrollViewport are available
      if (!virtualizer || !scrollViewport || targetIndex === -1) return;

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

  return { virtualizerRef, scrollViewportRef, handleSectionToggle, stickyAccepted, stickyIced };
}
