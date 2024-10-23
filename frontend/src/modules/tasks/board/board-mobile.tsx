import { useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import BoardHeader from '~/modules/tasks/board-header';
import { BoardColumn } from '~/modules/tasks/board/board-column';
import WorkspaceActions from '~/modules/tasks/board/workspace-actions';
import type { TaskStates } from '~/modules/tasks/types';
import { WorkspaceBoardRoute } from '~/routes/workspaces';
import { useWorkspaceUIStore } from '~/store/workspace-ui';
import type { Project } from '~/types/app';

export function BoardMobile({
  workspaceId,
  projects,
  tasksState,
}: {
  tasksState: Record<string, TaskStates>;
  projects: Project[];
  workspaceId: string;
}) {
  const { workspaces } = useWorkspaceUIStore();

  const { project } = useSearch({
    from: WorkspaceBoardRoute.id,
  });

  // Finding the project based on the query parameter or defaulting to the first project
  const currentProject = useMemo(() => {
    if (project) return projects.find((p) => p.slug === project) || projects[0];
    return projects[0];
  }, [project, projects]);
  return (
    <>
      <BoardHeader>
        <WorkspaceActions project={currentProject} />
      </BoardHeader>
      <BoardColumn tasksState={tasksState} project={currentProject} settings={workspaces[workspaceId]?.[currentProject.id]} />
    </>
  );
}
