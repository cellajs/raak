import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { Project } from 'sdk';
import { Virtualizer, type VirtualizerHandle, WindowVirtualizer } from 'virtua';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { BoardPanelBody } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { defaultPanelPrefs, type TogglableStatusType, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { MotionTaskCard } from '~/modules/task/card/motion-task-card';
import { DraftTaskItem } from '~/modules/task/draft-task-item';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getDraftDisplayOrder, getTargetIndexByStatus } from '~/modules/task/helpers/order-helpers';
import { registerPanelScroller } from '~/modules/task/helpers/panel-scroll-registry';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { usePanelAutoScroll } from '~/modules/task/hooks/use-panel-drop-target';
import { useStatusSectionSticky } from '~/modules/task/hooks/use-status-section-sticky';
import { TaskPanelEmpty } from '~/modules/task/panel/panel-empty';
import { PanelStatusSection } from '~/modules/task/panel/panel-status-section';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskStatus } from '~/modules/task/task-properties';
import type { TaskCounts, TaskProps } from '~/modules/task/types';
import { ScrollArea } from '~/modules/ui/scroll-area';

interface PanelProps {
  project: Project;
  tasks: TaskProps['task'][];
  counts: TaskCounts;
  /** When true, uses WindowVirtualizer and grows with content (no internal scrolling) */
  windowScroll?: boolean;
}

export const TaskPanelContent = memo(function TaskPanelContent({ project, tasks, counts, windowScroll }: PanelProps) {
  const isMobile = useBreakpointBelow('sm');
  const boardId = useBoardStore((state) => state.activeBoardId)!;
  const setActivePanel = useBoardStore((state) => state.setActivePanel);
  const hasSelectedTasks = useTaskInteractionStore((s) => s.selectedTasks.length > 0);
  const toggleStatusView = useTaskBoardStore(({ togglePanelSectionExpandState }) => togglePanelSectionExpandState);

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
    return registerPanelScroller(project.id, (taskId) => {
      const index = tasksRef.current.findIndex((t) => t.id === taskId);
      if (index === -1) return;
      virtualizerRef.current?.scrollToIndex(index, { align: 'nearest', smooth: false });
    });
  }, [project.id]);

  // Auto-scroll the panel's scroll viewport during drag operations.
  // No-op when scrollViewportRef is unattached (mobile / windowScroll branches).
  // The drop target itself is registered one level up in `board-panel.tsx`
  // so it remains live when the panel is collapsed.
  usePanelAutoScroll(scrollViewportRef);

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
    (state) => state.panelData[boardId]?.[project.id]?.prefs || defaultPanelPrefs,
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

  const hasContent = !!tasks.length || !!counts.accepted || !!counts.iced;

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

  const onStatusChange = (newStatus: TaskStatus) => {
    if (newStatus === TaskStatus.Accepted) toggleStatusView(boardId, project.id, 'accepted', true);
    if (newStatus === TaskStatus.Iced) toggleStatusView(boardId, project.id, 'iced', true);

    useTaskInteractionStore.getState().updateDraftTask(project.id, {
      status: newStatus,
      displayOrder: getDraftDisplayOrder(newStatus, project.id),
    });
  };

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

  // Build status section slots (always rendered inline, sticky when conditions met)
  const topSlot =
    'accepted' in counts ? (
      <PanelStatusSection
        type={'accepted'}
        counts={counts}
        projectId={project.id}
        isSticky={stickyAccepted}
        onToggle={handleSectionToggle}
      />
    ) : undefined;

  const bottomSlot =
    'iced' in counts ? (
      <PanelStatusSection
        type={'iced'}
        counts={counts}
        projectId={project.id}
        isSticky={stickyIced}
        onToggle={handleSectionToggle}
      />
    ) : undefined;

  // Activate panel on mouse enter or focus (desktop)
  const handlePanelActivation = () => {
    if (!isMobile) setActivePanel(project.id);
  };

  // Shared task renderer for both virtualizer branches (drafts are desktop-only)
  const renderTask = (task: TaskProps['task']) => {
    if (isDraftTask(task)) {
      if (isMobile) return null;
      return <DraftTaskItem key={task.id} task={task} project={project} onStatusChange={onStatusChange} />;
    }
    return <MotionTaskCard key={task.id} task={task} />;
  };

  return (
    <BoardPanelBody
      hasSelection={hasSelectedTasks}
      windowScroll={windowScroll}
      onMouseEnter={handlePanelActivation}
      onFocusCapture={handlePanelActivation}
    >
      {isMobile || windowScroll ? (
        <div className="mb-10 flex h-full flex-col" id={`tasks-list-${project.id}`}>
          {/* Accepted section (mobile/windowScroll — always inline, no sticky) */}
          {topSlot}

          {hasContent ? (
            <div
              className="[&_li:has(.is-focused)]:z-10 [&_li:has([data-state=editing])]:z-10"
              id={`panel-tasks-${project.id}`}
            >
              <WindowVirtualizer ref={virtualizerRef} as="ul" item="li">
                {tasks.map(renderTask)}
              </WindowVirtualizer>
            </div>
          ) : (
            <TaskPanelEmpty projectId={project.id} />
          )}

          {/* Iced section (mobile/windowScroll — always inline, no sticky) */}
          {bottomSlot}
        </div>
      ) : (
        <ScrollArea
          id={project.id}
          className="mx-[-.05rem] min-h-0 flex-1"
          viewportRef={scrollViewportRef}
          viewportClassName="[&>div]:!flex [&>div]:!flex-col [&>div]:!grow"
          disableTrackClick
        >
          {/* Accepted section — inline, becomes sticky when active + expanded + intersecting */}
          {topSlot}

          {/* Fallback container for create task form */}
          <div id={`fallback-container-${project.id}`} className="z-104 mx-2" />

          {/* Render tasks */}
          <div className="flex flex-1 flex-col" id={`tasks-list-${project.id}`}>
            {hasContent ? (
              <div
                className="grow [&_li:has(.is-focused)]:z-10 [&_li:has([data-state=editing])]:z-10"
                id={`panel-tasks-${project.id}`}
              >
                {/* startMargin in px based of button size */}
                <Virtualizer
                  ref={virtualizerRef}
                  as="ul"
                  item="li"
                  scrollRef={scrollViewportRef}
                  startMargin={counts.accepted || counts.acceptedCutOff ? 32 : 0}
                >
                  {tasks.map(renderTask)}
                </Virtualizer>
              </div>
            ) : (
              <TaskPanelEmpty projectId={project.id} />
            )}
          </div>

          {/* Iced section — inline, becomes sticky when active + expanded + intersecting */}
          {bottomSlot}
        </ScrollArea>
      )}
    </BoardPanelBody>
  );
});
