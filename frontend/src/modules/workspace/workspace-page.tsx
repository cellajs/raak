import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { z } from 'zod';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { useTaskDropMonitor } from '~/modules/task/hooks/use-task-drop-monitor';
import type { boardSearchSchema } from '~/modules/task/search-params-schemas';
import { TaskSheetHandler } from '~/modules/task/task-sheet-handler';
import { TasksHotkeys } from '~/modules/task/tasks-hotkeys';
import { workspaceQueryOptions } from '~/modules/workspace/query';
import { flattenInfiniteData } from '~/query/basic/flatten';

export type WorkspaceSearch = z.infer<typeof boardSearchSchema>;

interface Props {
  workspaceId: string;
  organizationId: string;
  tenantId: string;
  children: ReactNode;
}

/**
 * Workspace page with drag-and-drop task management.
 */
function WorkspacePage({ workspaceId, organizationId, tenantId, children }: Props) {
  useSuspenseQuery(workspaceQueryOptions(workspaceId, organizationId, tenantId));

  const { data: projectsData } = useSuspenseInfiniteQuery(projectsListQueryOptions({ workspaceId, include: 'counts' }));
  const projects = flattenInfiniteData<EnrichedProject>(projectsData);

  useTaskDropMonitor(tenantId, organizationId);

  return (
    <>
      <TaskSheetHandler />
      <TasksHotkeys projects={projects} />
      {children}
    </>
  );
}

export { WorkspacePage };
