import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { BirdIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization, Project, Workspace } from 'sdk';
import { appConfig } from 'shared';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { DataTable } from '~/modules/common/data-table/data-table';
import { useSortColumns } from '~/modules/common/data-table/sort-columns';
import { projectsListQueryOptions } from '~/modules/project/query';
import { searchFilterFunction } from '~/modules/task/helpers/search-filter';
import { isProjectReadOnly } from '~/modules/task/hooks/use-read-only';
import { publicTasksTableQueryOptions } from '~/modules/task/public-query';
import { deriveTasksQueryParams, tasksTableQueryOptions } from '~/modules/task/query';
import { TasksTableBar } from '~/modules/task/table/tasks-bar';
import { useColumns } from '~/modules/task/table/tasks-columns';
import type { Task, TaskSearch } from '~/modules/task/types';
import { flattenInfiniteData } from '~/query/basic/flatten';

const LIMIT = appConfig.requestLimits.tasksTable;

export type TaskTableProps = {
  projects?: Project[];
  workspace?: Workspace;
  publicView?: boolean;
  organization?: Organization;
  tenantId?: string;
};

export type ResolvedTaskTableProps = Omit<TaskTableProps, 'projects'> & { projects: Project[] };

export default function TasksTable({
  projects: projectsProp,
  workspace,
  publicView,
  organization,
  tenantId,
}: TaskTableProps) {
  const { t } = useTranslation();
  const { search, setSearch } = useSearchParams<TaskSearch>({});

  // Fetch projects for workspace tables; use provided projects for single-project tables
  const { data: fetchedData } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: workspace?.id, include: 'counts' }),
    enabled: !projectsProp,
  });
  const projects = projectsProp ?? flattenInfiniteData<Project>(fetchedData);

  // Table state
  const { q, sort, order } = search;
  const limit = LIMIT;

  // Build columns
  const [columns, setColumns] = useColumns(projects, { hideProject: !workspace, organization, tenantId });
  const [selected, setSelected] = useState<Task[]>([]);
  const [isCompact, setIsCompact] = useState(true);
  const { sortColumns, setSortColumns: onSortColumnsChange } = useSortColumns(sort, order, setSearch);

  const queryParams = publicView ? undefined : deriveTasksQueryParams(workspace, projects[0]);
  const queryOptions = queryParams
    ? tasksTableQueryOptions({ ...search, ...queryParams })
    : publicTasksTableQueryOptions({ ...search, projectId: projects[0]?.id });

  // biome-ignore lint/suspicious/noExplicitAny: union of query options with different key shapes
  const { data, error, isLoading, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery(queryOptions as any) as {
    data: InfiniteData<{ items: Task[]; total: number }> | undefined;
    error: Error | null;
    isLoading: boolean;
    isFetching: boolean;
    fetchNextPage: () => void;
    hasNextPage: boolean;
  };

  // Flatten pages into a single array, preserving item references from previous
  // pages so memo'd Row components don't re-render when a new page loads.
  const fetchedRows = useMemo(() => {
    if (!data) return undefined;
    return data.pages.flatMap(({ items }) => items);
  }, [data]);
  const isOnline = useOnlineManager();
  const rows = !fetchedRows
    ? undefined
    : isOnline
      ? fetchedRows
      : fetchedRows.filter((row) => searchFilterFunction(search, row));

  // isFetching already includes next page fetch scenario
  const fetchMore = useCallback(async () => {
    if (!hasNextPage || isLoading || isFetching) return;
    await fetchNextPage();
  }, [hasNextPage, isLoading, isFetching]);

  const onSelectedRowsChange = (value: Set<string>) => {
    if (rows) setSelected(rows.filter((row) => value.has(row.id)));
  };

  const selectedRowIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const isRowSelectionDisabled = useCallback((row: Task) => isProjectReadOnly(row.projectId), []);

  return (
    <div className="flex h-full flex-col gap-4">
      <TasksTableBar
        selected={selected}
        searchVars={{ ...search, limit }}
        columns={columns}
        setColumns={setColumns}
        projects={projects}
        workspace={workspace}
        publicView={publicView}
        clearSelection={() => setSelected([])}
        isCompact={isCompact}
        setIsCompact={setIsCompact}
      />
      <DataTable<Task>
        {...{
          rows,
          rowHeight: 52,
          rowKeyGetter: (row) => row.id,
          columns,
          enableVirtualization: true,
          enableStickyHeader: true,
          limit,
          error,
          isLoading,
          isFetching,
          isFiltered: !!q,
          hasNextPage,
          fetchMore,
          selectedRows: selectedRowIds,
          onSelectedRowsChange,
          isRowSelectionDisabled,
          isCompact,
          sortColumns,
          onSortColumnsChange,
          NoRowsComponent: (
            <ContentPlaceholder
              icon={BirdIcon}
              title="c:no_resource_yet"
              titleProps={{ resource: t('c:task_other').toLowerCase() }}
            />
          ),
        }}
      />
    </div>
  );
}
