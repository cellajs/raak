import { memo } from 'react';
import type { Project } from 'sdk';
import { Virtualizer, WindowVirtualizer } from 'virtua';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { BoardPanelBody } from '~/modules/common/board/board-panel';
import { hintFadeOut } from '~/modules/common/resizable-panels/resizable-panels';
import type { TogglableStatusType } from '~/modules/task/board/task-board-store';
import { MotionTaskCard } from '~/modules/task/card/motion-task-card';
import { DraftTaskItem } from '~/modules/task/draft-task-item';
import { revealDraftHostPanel } from '~/modules/task/helpers/create-task';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getDraftDisplayOrder } from '~/modules/task/helpers/order-helpers';
import { usePanelScrolling } from '~/modules/task/hooks/use-panel-scrolling';
import { ListFocusScope } from '~/modules/task/panel/list-focus-scope';
import { PanelStatusSection } from '~/modules/task/panel/panel-status-section';
import { PanelTasksContext } from '~/modules/task/panel/panel-tasks-context';
import { collapsedMainCount } from '~/modules/task/panel/task-panel-collapsed';
import { TaskPanelEmpty } from '~/modules/task/panel/task-panel-empty';
import { taskInteractionStore, useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { TaskStatus } from '~/modules/task/task-properties';
import type { TaskCounts, TaskProps } from '~/modules/task/types';
import { ScrollArea } from '~/modules/ui/scroll-area';
import { cn } from '~/utils/cn';
import { tw } from '~/utils/tw';

// virtua keeps measured heights by index and never renders a row it measured at 0px, so that row is never measured again.
// Opening or closing the create form hands the form's height to whichever row takes its index, and the form collapses to 0px on submit.
const rowHeightGuardClass = tw('[&>ul>li]:min-h-px');
const raisedRowClass = tw('[&_li:has(.is-focused)]:z-10 [&_li:has([data-state=editing])]:z-10');

interface TaskPanelContentProps {
  project: Project;
  /** The board panel showing these tasks: the project, or one split section of it. */
  panelId: string;
  tasks: TaskProps['task'][];
  counts: TaskCounts;
  /** When true, uses WindowVirtualizer and grows with content (no internal scrolling) */
  windowScroll?: boolean;
}

export const TaskPanelContent = memo(function TaskPanelContent({ project, panelId, tasks, counts, windowScroll }: TaskPanelContentProps) {
  const isMobile = useBreakpointBelow('sm');
  const hasSelectedTasks = useTaskInteractionStore((state) => state.selectedTaskIds.length > 0);

  const { virtualizerRef, scrollViewportRef, handleSectionToggle, shift } = usePanelScrolling({
    projectId: project.id,
    panelId,
    tasks,
    counts,
    isMobile,
    windowScroll: !!windowScroll,
  });
  const sectionWindowMode = isMobile || !!windowScroll;
  const itemIds = tasks.map(({ id }) => id);

  const hasContent = !!tasks.length || !!counts.accepted || !!counts.iced;
  const draftIndex = tasks.findIndex(isDraftTask);
  // The sticky status headers would overlap the create form
  const hostsDraft = draftIndex !== -1;
  // Mounted wherever the panel is scrolled, so the form is measured before the jump to it.
  // An unmeasured form is jumped to by estimate: a blank panel while it mounts, then visible corrections.
  const keepDraftMounted = hostsDraft ? [draftIndex] : undefined;

  const handleStatusChange = (newStatus: TaskStatus) => {
    revealDraftHostPanel(project.id, newStatus);

    taskInteractionStore.getState().updateDraftTask(project.id, { status: newStatus, displayOrder: getDraftDisplayOrder(newStatus, project.id) });
  };

  const statusSection = (type: TogglableStatusType) => (
    <PanelStatusSection
      type={type}
      counts={counts}
      projectId={project.id}
      scrollRef={scrollViewportRef}
      windowMode={sectionWindowMode}
      onToggle={handleSectionToggle}
      suppressed={hostsDraft}
    />
  );
  const topSlot = counts.showAccepted ? statusSection('accepted') : undefined;
  const bottomSlot = counts.showIced ? statusSection('iced') : undefined;

  // Keyboard focus scrolls a card only to the viewport edge, under a pinned section bar (h-9). The margin holds even
  // while a bar is slid away: it slides in on the scroll that focus makes, too late for a margin that followed it.
  const cardScrollMargin = cn(
    counts.showAccepted && !hostsDraft && '[&_[data-task-card-id]]:scroll-mt-[calc(var(--sticky-stack-nav)+--spacing(9))]',
    counts.showIced && !hostsDraft && '[&_[data-task-card-id]]:scroll-mb-9',
  );

  const renderTask = (task: TaskProps['task']) => {
    if (isDraftTask(task)) return <DraftTaskItem key={task.id} task={task} project={project} onStatusChange={handleStatusChange} />;
    return <MotionTaskCard key={task.id} task={task} />;
  };

  return (
    <PanelTasksContext.Provider value={tasks}>
      <BoardPanelBody hasSelection={hasSelectedTasks} windowScroll={windowScroll} collapsedCount={collapsedMainCount(counts)}>
        {isMobile || windowScroll ? (
          <div className="mb-10 flex h-full flex-col">
            {topSlot}

            <div className={hintFadeOut}>
              {hasContent ? (
                <ListFocusScope
                  className={cn(rowHeightGuardClass, cardScrollMargin, raisedRowClass)}
                  itemIds={itemIds}
                  viewportRef={scrollViewportRef}
                >
                  <WindowVirtualizer ref={virtualizerRef} as="ul" item="li" shift={shift}>
                    {tasks.map(renderTask)}
                  </WindowVirtualizer>
                </ListFocusScope>
              ) : (
                <TaskPanelEmpty projectId={project.id} />
              )}
            </div>

            {bottomSlot}
          </div>
        ) : (
          // h-auto/min-h-full override the content div's inline height:100% so it spans the full
          // scroll content: it is the sticky section headers' containing block, and a
          // viewport-height block would stop them pinning after one viewport of scrolling.
          // The viewport spans the frame's left line and pads its content back off it: a focused card's bar draws
          // on that line, and the viewport clips whatever lies past its own edge.
          <ScrollArea
            className="-ml-px min-h-0 flex-1"
            viewportRef={scrollViewportRef}
            viewportClassName="[&>div]:flex! [&>div]:flex-col! [&>div]:grow! [&>div]:h-auto! [&>div]:min-h-full! [&>div]:pl-px"
            disableTrackClick
          >
            {topSlot}

            <div className={cn('flex flex-1 flex-col', hintFadeOut)}>
              {hasContent ? (
                <ListFocusScope
                  className={cn(rowHeightGuardClass, cardScrollMargin, raisedRowClass, 'grow')}
                  itemIds={itemIds}
                  viewportRef={scrollViewportRef}
                >
                  {/* startMargin: the accepted bar's height (h-9), which stays in the flow above the list */}
                  <Virtualizer
                    ref={virtualizerRef}
                    as="ul"
                    item="li"
                    scrollRef={scrollViewportRef}
                    keepMounted={keepDraftMounted}
                    shift={shift}
                    startMargin={counts.accepted || counts.acceptedCutOff ? 36 : 0}
                  >
                    {tasks.map(renderTask)}
                  </Virtualizer>
                </ListFocusScope>
              ) : (
                <TaskPanelEmpty projectId={project.id} />
              )}
            </div>

            {bottomSlot}
          </ScrollArea>
        )}
      </BoardPanelBody>
    </PanelTasksContext.Provider>
  );
});
