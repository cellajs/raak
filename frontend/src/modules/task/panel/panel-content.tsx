import { memo } from 'react';
import type { Project } from 'sdk';
import { Virtualizer, WindowVirtualizer } from 'virtua';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { BoardPanelBody } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { MotionTaskCard } from '~/modules/task/card/motion-task-card';
import { DraftTaskItem } from '~/modules/task/draft-task-item';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getDraftDisplayOrder } from '~/modules/task/helpers/order-helpers';
import { usePanelScrolling } from '~/modules/task/hooks/use-panel-scrolling';
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

  // Scroll machinery (virtualizer/viewport refs, sticky sections, section-toggle + create-form /
  // new-task scroll-into-view). Kept in a hook so this component stays layout-only.
  const { virtualizerRef, scrollViewportRef, handleSectionToggle, stickyAccepted, stickyIced } = usePanelScrolling({
    projectId: project.id,
    boardId,
    tasks,
    isMobile,
    windowScroll: !!windowScroll,
  });

  const hasContent = !!tasks.length || !!counts.accepted || !!counts.iced;

  const onStatusChange = (newStatus: TaskStatus) => {
    if (newStatus === TaskStatus.Accepted) toggleStatusView(boardId, project.id, 'accepted', true);
    if (newStatus === TaskStatus.Iced) toggleStatusView(boardId, project.id, 'iced', true);

    useTaskInteractionStore.getState().updateDraftTask(project.id, {
      status: newStatus,
      displayOrder: getDraftDisplayOrder(newStatus, project.id),
    });
  };

  // Build status section slots (always rendered inline, sticky when conditions met)
  const topSlot = counts.showAccepted ? (
    <PanelStatusSection
      type={'accepted'}
      counts={counts}
      projectId={project.id}
      isSticky={stickyAccepted}
      onToggle={handleSectionToggle}
    />
  ) : undefined;

  const bottomSlot = counts.showIced ? (
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
