import { useSearch } from '@tanstack/react-router';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useBreakpoints } from '~/hooks/use-breakpoints';
import { useEventListener } from '~/hooks/use-event-listener';
import { useMeasure } from '~/hooks/use-measure';
import { dispatchCustomEvent } from '~/lib/custom-events';
import BoardHeader from '~/modules/tasks/board-header';
import { BoardColumn } from '~/modules/tasks/board/board-column';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '~/modules/ui/resizable';
import { WorkspaceBoardRoute } from '~/routes/workspaces';
import { useWorkspaceStore } from '~/store/workspace';
import type { Project } from '~/types/app';
import type { ContextEntity, Membership } from '~/types/common';

import type { ImperativePanelHandle } from 'react-resizable-panels';
import { EmptyBoard } from '~/modules/tasks/board/empty-board';
import WorkspaceActions from '~/modules/tasks/board/workspace-actions';
import type { TaskCardToggleSelectEvent, TaskStates, TaskStatesChangeEvent } from '~/modules/tasks/types';
import { useWorkspaceQuery } from '~/modules/workspaces/helpers/use-workspace';
import { useWorkspaceUIStore } from '~/store/workspace-ui';
import TasksHotkeysManager from './tasks-hotkeys';

// TODO empty space width should be dynamic based on window width and amount of projects and width of each project?
const PANEL_MIN_WIDTH = 400;
// Allow resizing of panels
const EMPTY_SPACE_WIDTH = 600;

function getScrollerWidth(containerWidth: number, projectsLength: number) {
  if (containerWidth === 0) return '100%';
  return containerWidth / projectsLength > PANEL_MIN_WIDTH ? '100%' : projectsLength * PANEL_MIN_WIDTH + EMPTY_SPACE_WIDTH;
}

function BoardDesktop({
  workspaceId,
  projects,
  tasksState,
}: {
  tasksState: Record<string, TaskStates>;
  projects: Project[];
  workspaceId: string;
}) {
  const { ref, bounds } = useMeasure();
  const panelRefs = useRef<Record<string, ImperativePanelHandle | null>>({});
  const { changePanels, workspacesPanels, workspaces } = useWorkspaceUIStore();

  const panelStorage = useMemo(
    () => ({
      getItem: (_: string) => workspacesPanels[workspaceId] ?? null,
      setItem: (_: string, value: string) => changePanels(workspaceId, value),
    }),
    [workspacesPanels, workspaceId],
  );

  const projectSettingsMap = useMemo(() => {
    return projects.map((project) => ({
      project,
      settings: workspaces[workspaceId]?.[project.id],
    }));
  }, [projects, workspaces, workspaceId]);

  const scrollerWidth = getScrollerWidth(bounds.width, projectSettingsMap.length);
  const panelMinSize = useMemo(() => {
    if (typeof scrollerWidth === 'number') return (PANEL_MIN_WIDTH / scrollerWidth) * 100;

    const projectsLength = projectSettingsMap.length;
    return 100 / (projectsLength + 1); // + 1 to allow resizing
  }, [scrollerWidth, projectSettingsMap]);

  useEffect(() => {
    for (const { project } of projectSettingsMap) {
      const panel = panelRefs.current[project.id];
      if (panel) panel.expand();
    }
  }, [projectSettingsMap]);

  return (
    <>
      <TasksHotkeysManager workspaceId={workspaceId} projects={projects} mode={'board'} />
      <div className="transition sm:h-[calc(100vh-4rem)] md:h-[calc(100vh-4.88rem)] overflow-x-auto" ref={ref as React.Ref<HTMLDivElement>}>
        <div className="h-[inherit]" style={{ width: scrollerWidth }}>
          <ResizablePanelGroup
            direction="horizontal"
            className="flex gap-2 group/board"
            id="project-panels"
            storage={panelStorage}
            autoSaveId={workspaceId}
          >
            {projectSettingsMap.map(({ project, settings }, index) => (
              <Fragment key={project.id}>
                <ResizablePanel
                  // biome-ignore lint/suspicious/noAssignInExpressions: need to minimize
                  ref={(el) => (panelRefs.current[project.id] = el)}
                  id={project.id}
                  order={project.membership?.order || index}
                  collapsedSize={panelMinSize * 0.1}
                  minSize={panelMinSize}
                  collapsible
                >
                  <BoardColumn tasksState={tasksState} project={project} settings={settings} />
                </ResizablePanel>
                {index < projects.length - 1 && (
                  <ResizableHandle className="w-1.5 rounded border border-background -mx-2 bg-transparent hover:bg-primary/50 data-[resize-handle-state=drag]:bg-primary transition-all" />
                )}
              </Fragment>
            ))}
          </ResizablePanelGroup>
        </div>
      </div>
    </>
  );
}

export default function Board() {
  const { focusedTaskId, selectedTasks, setSearchQuery, setSelectedTasks } = useWorkspaceStore();
  const prevFocusedRef = useRef<string | null>(focusedTaskId);
  const {
    data: { workspace, projects: queryProjects },
    updateProjectMembership,
    updateWorkspaceMembership,
  } = useWorkspaceQuery();

  const isMobile = useBreakpoints('max', 'sm');

  const { workspaces } = useWorkspaceUIStore();

  const [tasksState, setTasksState] = useState<Record<string, TaskStates>>({});

  const { project, q } = useSearch({
    from: WorkspaceBoardRoute.id,
  });

  // TODO maybe find other way
  const projects = useMemo(
    () => queryProjects.filter((p) => !p.membership?.archived).sort((a, b) => (a.membership?.order ?? 0) - (b.membership?.order ?? 0)),
    [queryProjects],
  );

  // Finding the project based on the query parameter or defaulting to the first project
  const mobileDeviceProject = useMemo(() => {
    if (project) return projects.find((p) => p.slug === project) || projects[0];
    return projects[0];
  }, [project, projects]);

  const setTaskState = (taskId: string, state: TaskStates) => {
    setTasksState((prevState) => ({
      ...prevState,
      [taskId]: state,
    }));
  };

  const handleToggleTaskSelect = (event: TaskCardToggleSelectEvent) => {
    const { selected, taskId } = event.detail;
    if (selected) return setSelectedTasks([...selectedTasks, taskId]);
    return setSelectedTasks(selectedTasks.filter((id) => id !== taskId));
  };

  const handleEntityUpdate = (event: { detail: { membership: Membership; entity: ContextEntity } }) => {
    const { entity, membership } = event.detail;
    if (entity === 'project') updateProjectMembership(membership);
    if (entity === 'workspace') updateWorkspaceMembership(membership);
  };

  const handleTaskState = (event: TaskStatesChangeEvent) => {
    const { taskId, state, sheet } = event.detail;
    if (sheet) return;
    if (state === 'currentState') return setTaskState(taskId, tasksState[taskId] === 'folded' ? 'folded' : 'expanded');
    setTaskState(taskId, state);
  };

  useEventListener('menuEntityChange', handleEntityUpdate);
  useEventListener('changeTaskState', handleTaskState);
  useEventListener('toggleSelectTask', handleToggleTaskSelect);

  useEffect(() => {
    const { current: prevFocused } = prevFocusedRef;

    // Prevent state change if the focused task hasn't changed
    if (prevFocused === focusedTaskId) return;

    // Check if the previously focused task exists
    if (prevFocused) {
      const currentState = tasksState[prevFocused];
      const newState = currentState === 'folded' || !currentState ? 'folded' : 'expanded';

      setTimeout(() => setTaskState(prevFocused, newState), 0);
      // Fold the subtasks of the previously focused task
      dispatchCustomEvent('changeSubtaskState', { taskId: prevFocused, state: 'folded' });
    }

    // Update the previous focused task ID
    prevFocusedRef.current = focusedTaskId;
  }, [focusedTaskId, tasksState, setTaskState]);

  useEffect(() => {
    if (q?.length) setSearchQuery(q);
  }, []);

  return (
    <>
      <BoardHeader>
        <WorkspaceActions project={mobileDeviceProject} />
      </BoardHeader>
      {!projects.length ? (
        <EmptyBoard />
      ) : (
        <>
          {isMobile ? (
            <BoardColumn tasksState={tasksState} project={mobileDeviceProject} settings={workspaces[workspace.id]?.[mobileDeviceProject.id]} />
          ) : (
            <BoardDesktop tasksState={tasksState} projects={projects} workspaceId={workspace.id} />
          )}
        </>
      )}
    </>
  );
}
