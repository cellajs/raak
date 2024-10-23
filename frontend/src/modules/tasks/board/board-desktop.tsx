import { Fragment, useMemo, useRef } from 'react';
import { useMeasure } from '~/hooks/use-measure';
import { BoardColumn } from '~/modules/tasks/board/board-column';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '~/modules/ui/resizable';
import type { Project } from '~/types/app';

import type { ImperativePanelHandle } from 'react-resizable-panels';
import BoardHeader from '~/modules/tasks/board-header';
import WorkspaceActions from '~/modules/tasks/board/workspace-actions';
import TasksHotkeysManager from '~/modules/tasks/tasks-hotkeys';
import type { TaskStates } from '~/modules/tasks/types';
import { useWorkspaceUIStore } from '~/store/workspace-ui';

// TODO empty space width should be dynamic based on window width and amount of projects and width of each project?
const PANEL_MIN_WIDTH = 400;
// Allow resizing of panels
const EMPTY_SPACE_WIDTH = 600;

function getScrollerWidth(containerWidth: number, projectsLength: number) {
  if (containerWidth === 0) return '100%';
  return containerWidth / projectsLength > PANEL_MIN_WIDTH ? '100%' : projectsLength * PANEL_MIN_WIDTH + EMPTY_SPACE_WIDTH;
}

export default function BoardDesktop({
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

  const scrollerWidth = getScrollerWidth(bounds.width, projects.length);
  const panelMinSize = useMemo(() => {
    if (typeof scrollerWidth === 'number') return (PANEL_MIN_WIDTH / scrollerWidth) * 100;

    return 100 / (projects.length + 1); // + 1 to allow resizing
  }, [scrollerWidth, projects.length]);

  return (
    <>
      <BoardHeader>
        <WorkspaceActions />
      </BoardHeader>
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
