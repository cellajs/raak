import { memo } from 'react';
import type { Project } from 'sdk';
import { Virtualizer, WindowVirtualizer } from 'virtua';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { BoardPanelBody } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { hintFadeOut } from '~/modules/common/resizable-panels/resizable-panels';
import { MotionTaskCard } from '~/modules/task/card/motion-task-card';
import { DraftTaskItem } from '~/modules/task/draft-task-item';
import { revealDraftHostPanel } from '~/modules/task/helpers/create-task';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { getDraftDisplayOrder } from '~/modules/task/helpers/order-helpers';
import { usePanelScrolling } from '~/modules/task/hooks/use-panel-scrolling';
import { collapsedMainCount } from '~/modules/task/panel/panel-collapsed';
import { TaskPanelEmpty } from '~/modules/task/panel/panel-empty';
import { PanelStatusSection } from '~/modules/task/panel/panel-status-section';
import { PanelTasksContext } from '~/modules/task/panel/panel-tasks-context';
import { TaskListFocusScope } from '~/modules/task/panel/task-list-focus-scope';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { TaskStatus } from '~/modules/task/task-properties';
import type { TaskCounts, TaskProps } from '~/modules/task/types';
import { ScrollArea } from '~/modules/ui/scroll-area';
import { cn } from '~/utils/cn';

// virtua keeps measured heights by index and never renders a row it measured at 0px, so that row is never measured again.
// Opening or closing the create form hands the form's height to whichever row takes its index, and the form collapses to 0px on submit.
const rowHeightGuard = '[&>ul>li]:min-h-px';

interface PanelProps {
  project: Project;
  tasks: TaskProps['task'][];
  counts: TaskCounts;
  /** When true, uses WindowVirtualizer and grows with content (no internal scrolling) */
  windowScroll?: boolean;
}

export const TaskPanelContent = memo(function TaskPanelContent({ project, tasks, counts, windowScroll }: PanelProps) {
  const isMobile = useBreakpointBelow('sm');
  const setActivePanel = useBoardStore((state) => state.setActivePanel);
  const hasSelectedTasks = useTaskInteractionStore((s) => s.selectedTaskIds.length > 0);

  // Scroll machinery (virtualizer/viewport refs, section-toggle + create-form /
  // new-task scroll-into-view). Kept in a hook so this component stays layout-only.
  const { virtualizerRef, scrollViewportRef, handleSectionToggle } = usePanelScrolling({
    projectId: project.id,
    tasks,
    isMobile,
    windowScroll: !!windowScroll,
  });
  const sectionWindowMode = isMobile || !!windowScroll;

  const hasContent = !!tasks.length || !!counts.accepted || !!counts.iced;
  const draftIndex = tasks.findIndex(isDraftTask);
  // The sticky status headers would overlap the create form
  const hostsDraft = draftIndex !== -1;
  // Mounted wherever the panel is scrolled, so the form is measured before the jump to it and lands in one step.
  // An unmeasured form is jumped to by estimate: a blank panel while it mounts, then visible corrections.
  const keepDraftMounted = hostsDraft ? [draftIndex] : undefined;

  const onStatusChange = (newStatus: TaskStatus) => {
    revealDraftHostPanel(project.id, newStatus);

    useTaskInteractionStore.getState().updateDraftTask(project.id, { status: newStatus, displayOrder: getDraftDisplayOrder(newStatus, project.id) });
  };

  // Build status section slots (sticky at their edge, shown/hidden by scroll direction)
  const topSlot = counts.showAccepted ? (
    <PanelStatusSection
      type={'accepted'}
      counts={counts}
      projectId={project.id}
      scrollRef={scrollViewportRef}
      windowMode={sectionWindowMode}
      onToggle={handleSectionToggle}
      suppressed={hostsDraft}
    />
  ) : undefined;

  const bottomSlot = counts.showIced ? (
    <PanelStatusSection
      type={'iced'}
      counts={counts}
      projectId={project.id}
      scrollRef={scrollViewportRef}
      windowMode={sectionWindowMode}
      onToggle={handleSectionToggle}
      suppressed={hostsDraft}
    />
  ) : undefined;

  // Keyboard focus scrolls a card only to the viewport edge, under a pinned section bar (h-9). The margin holds even
  // while a bar is slid away: it slides in on the scroll that focus makes, too late for a margin that followed it.
  const cardScrollMargin = cn(
    counts.showAccepted && !hostsDraft && '[&_[data-task-card-id]]:scroll-mt-[calc(var(--sticky-stack-nav)+--spacing(9))]',
    counts.showIced && !hostsDraft && '[&_[data-task-card-id]]:scroll-mb-9',
  );

  // Activate panel on mouse enter or focus (desktop)
  const handlePanelActivation = () => {
    if (!isMobile) setActivePanel(project.id);
  };

  // Shared task renderer for both virtualizer branches
  const renderTask = (task: TaskProps['task']) => {
    if (isDraftTask(task)) return <DraftTaskItem key={task.id} task={task} project={project} onStatusChange={onStatusChange} />;
    return <MotionTaskCard key={task.id} task={task} />;
  };

  return (
    <PanelTasksContext.Provider value={tasks}>
      <BoardPanelBody
        hasSelection={hasSelectedTasks}
        windowScroll={windowScroll}
        collapsedCount={collapsedMainCount(counts)}
        onMouseEnter={handlePanelActivation}
        onFocusCapture={handlePanelActivation}
      >
        {isMobile || windowScroll ? (
          <div className="mb-10 flex h-full flex-col" id={`tasks-list-${project.id}`}>
            {/* Accepted section (window-scroll sticky, direction-based visibility) */}
            {topSlot}

            <div className={hintFadeOut}>
              {hasContent ? (
                <TaskListFocusScope
                  id={`panel-tasks-${project.id}`}
                  className={cn(rowHeightGuard, cardScrollMargin, '[&_li:has(.is-focused)]:z-10 [&_li:has([data-state=editing])]:z-10')}
                  tasks={tasks}
                  viewportRef={scrollViewportRef}
                >
                  <WindowVirtualizer ref={virtualizerRef} as="ul" item="li">
                    {tasks.map(renderTask)}
                  </WindowVirtualizer>
                </TaskListFocusScope>
              ) : (
                <TaskPanelEmpty projectId={project.id} />
              )}
            </div>

            {/* Iced section (window-scroll sticky, direction-based visibility) */}
            {bottomSlot}
          </div>
        ) : (
          // h-auto/min-h-full override the content div's inline height:100% so it spans the full
          // scroll content: it is the sticky section headers' containing block, and a
          // viewport-height block would stop them pinning after one viewport of scrolling.
          <ScrollArea
            id={project.id}
            className="mx-[-.05rem] min-h-0 flex-1"
            viewportRef={scrollViewportRef}
            viewportClassName="[&>div]:!flex [&>div]:!flex-col [&>div]:!grow [&>div]:!h-auto [&>div]:!min-h-full"
            disableTrackClick
          >
            {/* Accepted section: sticky top, shown when scrolling up or resting at the top */}
            {topSlot}

            {/* Fallback container for create task form */}
            <div id={`fallback-container-${project.id}`} className={cn('z-104 mx-2', hintFadeOut)} />

            {/* Render tasks */}
            <div className={cn('flex flex-1 flex-col', hintFadeOut)} id={`tasks-list-${project.id}`}>
              {hasContent ? (
                <TaskListFocusScope
                  id={`panel-tasks-${project.id}`}
                  className={cn(rowHeightGuard, cardScrollMargin, 'grow [&_li:has(.is-focused)]:z-10 [&_li:has([data-state=editing])]:z-10')}
                  tasks={tasks}
                  viewportRef={scrollViewportRef}
                >
                  {/* startMargin: the accepted bar's height (h-9), which stays in the flow above the list */}
                  <Virtualizer
                    ref={virtualizerRef}
                    as="ul"
                    item="li"
                    scrollRef={scrollViewportRef}
                    keepMounted={keepDraftMounted}
                    startMargin={counts.accepted || counts.acceptedCutOff ? 36 : 0}
                  >
                    {tasks.map(renderTask)}
                  </Virtualizer>
                </TaskListFocusScope>
              ) : (
                <TaskPanelEmpty projectId={project.id} />
              )}
            </div>

            {/* Iced section: sticky bottom, shown when scrolling down or resting at the bottom */}
            {bottomSlot}
          </ScrollArea>
        )}
      </BoardPanelBody>
    </PanelTasksContext.Provider>
  );
});
