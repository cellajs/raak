import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { BirdIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization, Project, Workspace } from 'sdk';
import { appConfig } from 'shared';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { DataTable } from '~/modules/common/data-table/data-table';
import { useSortColumns } from '~/modules/common/data-table/sort-columns';
import { searchHighlightRowClass } from '~/modules/common/search-highlight';
import { projectsListQueryOptions } from '~/modules/project/query';
import { isProjectReadOnly } from '~/modules/project/use-read-only';
import { searchFilterFunction } from '~/modules/task/helpers/search-filter';
import { publicTasksTableQueryOptions } from '~/modules/task/public-query';
import { deriveTasksQueryParams, tasksTableQueryOptions } from '~/modules/task/query';
import { TableProjectsContext, useColumns } from '~/modules/task/table/tasks-columns';
import { TasksTableBar } from '~/modules/task/table/tasks-table-bar';
import type { BoardSearchParams, Task } from '~/modules/task/types';
import { flattenInfiniteData } from '~/query/basic/flatten';

const LIMIT = appConfig.requestLimits.tasksTable;

// Stable identity so it never invalidates DataTable's memoized Row components.
const rowKeyGetter = (row: Task) => row.id;

export type TaskTableProps = {
  projects?: Project[];
  workspace?: Workspace;
  publicView?: boolean;
  organization?: Organization;
  tenantId?: string;
};

export type ResolvedTaskTableProps = Omit<TaskTableProps, 'projects'> & { projects: Project[] };

export function TasksTable({ projects: projectsProp, workspace, publicView, organization, tenantId }: TaskTableProps) {
  const { t } = useTranslation();
  const { search, setSearch } = useSearchParams<BoardSearchParams>({});

  // Fetch projects for workspace tables; use provided projects for single-project tables
  const { data: fetchedData } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: workspace?.id, include: 'counts' }),
    enabled: !projectsProp,
  });
  // Memoized so the reactive project cells (TableProjectsContext) only re-render when the list
  // actually changes, not on every table render.
  const projects = useMemo(
    () => projectsProp ?? flattenInfiniteData<Project>(fetchedData),
    [projectsProp, fetchedData],
  );

  // Table state
  const { q, sort, order } = search;
  const limit = LIMIT;

  const [columns, setColumns] = useColumns({ hideProject: !workspace, organization, tenantId });
  const [selected, setSelected] = useState<Task[]>([]);
  const [isCompact, setIsCompact] = useState(true);
  const { sortColumns, setSortColumns: onSortColumnsChange } = useSortColumns(sort, order, setSearch);

  // Highlight mode ('=' prefix): fetch unfiltered and tint matches client-side, like the board
  const { highlight } = parseSearchQuery(q);
  const effectiveSearch = highlight ? { ...search, q: '' } : search;

  const queryParams = publicView ? undefined : deriveTasksQueryParams(workspace, projects[0]);
  const queryOptions = queryParams
    ? tasksTableQueryOptions({ ...effectiveSearch, ...queryParams })
    : publicTasksTableQueryOptions({ ...effectiveSearch, projectId: projects[0]?.id });

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
  // Stable row references prevent memoized rows from rerendering on unchanged offline filters.
  const rows = useMemo(() => {
    if (!fetchedRows) return undefined;
    return isOnline || highlight ? fetchedRows : fetchedRows.filter((row) => searchFilterFunction(search, row));
  }, [fetchedRows, isOnline, highlight, search]);

  // Tint matches among the loaded rows in highlight mode (search-filter strips the marker)
  const rowClass = useMemo(
    () =>
      highlight ? (row: Task) => (searchFilterFunction(search, row) ? searchHighlightRowClass : undefined) : undefined,
    [highlight, search],
  );

  // isFetching already includes next page fetch scenario
  const fetchMore = useCallback(async () => {
    if (!hasNextPage || isLoading || isFetching) return;
    await fetchNextPage();
  }, [hasNextPage, isLoading, isFetching, fetchNextPage]);

  const onSelectedRowsChange = useCallback(
    (value: Set<string>) => {
      if (rows) setSelected(rows.filter((row) => value.has(row.id)));
    },
    [rows],
  );

  const selectedRowIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);

  const isRowSelectionDisabled = useCallback((row: Task) => isProjectReadOnly(row.projectId), []);

  const noRowsComponent = useMemo(
    () => (
      <ContentPlaceholder
        icon={BirdIcon}
        title="c:no_resource_yet"
        titleProps={{ resource: t('c:task_other').toLowerCase() }}
      />
    ),
    [t],
  );

  return (
    <TableProjectsContext.Provider value={projects}>
      <div className="flex h-full flex-col gap-4">
        <TasksTableBar
          selected={selected}
          searchVars={{ ...effectiveSearch, limit }}
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
            rowKeyGetter,
            columns,
            enableVirtualization: true,
            enableStickyHeader: true,
            limit,
            error,
            isLoading,
            isFetching,
            isFiltered: !highlight && !!q,
            hasNextPage,
            fetchMore,
            rowClass,
            selectedRows: selectedRowIds,
            onSelectedRowsChange,
            isRowSelectionDisabled,
            isCompact,
            sortColumns,
            onSortColumnsChange,
            NoRowsComponent: noRowsComponent,
          }}
        />
      </div>
    </TableProjectsContext.Provider>
  );
}
