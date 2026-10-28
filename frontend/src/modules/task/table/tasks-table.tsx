import { type InfiniteData, useInfiniteQuery } from '@tanstack/react-query';
import { BirdIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization, Project, Workspace } from 'sdk';
import { appConfig } from 'shared';
import { formatSearchParts, parseSearchQuery } from 'shared/utils/parse-search-query';
import { useOnlineManager } from '~/hooks/use-online-manager';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { DataTable, rowKeyById } from '~/modules/common/data-table/data-table';
import { useSortColumns } from '~/modules/common/data-table/sort-columns';
import { useColumnVisibility } from '~/modules/common/data-table/use-column-visibility';
import { projectsListQueryOptions } from '~/modules/project/query';
import { isProjectReadOnly } from '~/modules/project/use-read-only';
import { matchesBoardSearch } from '~/modules/task/helpers/search-filter';
import { publicTasksTableQueryOptions } from '~/modules/task/public-query';
import { deriveTasksQueryParams, tasksTableQueryOptions } from '~/modules/task/query';
import { searchHighlightRowClass } from '~/modules/task/search-highlight';
import { useColumns } from '~/modules/task/table/tasks-columns';
import { TasksTableBar } from '~/modules/task/table/tasks-table-bar';
import { TaskSearchScope } from '~/modules/task/task-search-scope';
import type { BoardSearchParams, Task } from '~/modules/task/types';
import { flattenInfiniteData } from '~/query/basic/flatten';
import { useListQueryTotal } from '~/query/basic/use-list-query-total';

const tableLimit = appConfig.requestLimits.tasksTable;

export interface TasksTableProps {
  projects?: Project[];
  workspace?: Workspace;
  publicView?: boolean;
  organization?: Organization;
  tenantId?: string;
}

export interface ResolvedTasksTableProps extends Omit<TasksTableProps, 'projects'> {
  projects: Project[];
}

export function TasksTable({ projects: projectsProp, workspace, publicView, organization, tenantId }: TasksTableProps) {
  const { t } = useTranslation();
  const { search, setSearch } = useSearchParams<BoardSearchParams>();

  const { data: fetchedData } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: workspace?.id, include: 'counts' }),
    enabled: !projectsProp,
  });
  const projects = projectsProp ?? flattenInfiniteData<Project>(fetchedData);

  const { q, sort, order } = search;

  const [columns, setColumns] = useColumnVisibility(useColumns({ hideProject: !workspace, organization, tenantId, projects }));
  const [selected, setSelected] = useState<Task[]>([]);
  const [isCompact, setIsCompact] = useState(true);
  const { sortColumns, setSortColumns: onSortColumnsChange } = useSortColumns(sort, order, setSearch);

  // Highlight mode ('=' prefix): fetch without the terms to match, so only exclusions filter, and tint matches client-side, like the board
  const { highlight, effectiveQ, parts } = parseSearchQuery(q);
  const effectiveSearch = highlight ? { ...search, q: formatSearchParts(parts.filter((part) => part.exclude)) } : search;

  const queryParams = publicView ? undefined : deriveTasksQueryParams(workspace, projects[0]);
  const optionsFor = (tableSearch: BoardSearchParams) =>
    queryParams
      ? tasksTableQueryOptions({ ...tableSearch, ...queryParams })
      : publicTasksTableQueryOptions({ ...tableSearch, projectId: projects[0]?.id });
  const queryOptions = optionsFor(effectiveSearch);

  // biome-ignore lint/suspicious/noExplicitAny: union of query options with different key shapes
  const { data, error, isLoading, isFetching, fetchNextPage, hasNextPage } = useInfiniteQuery(queryOptions as any) as {
    data: InfiniteData<{ items: Task[]; total: number }> | undefined;
    error: Error | null;
    isLoading: boolean;
    isFetching: boolean;
    fetchNextPage: () => void;
    hasNextPage: boolean;
  };

  const fetchedRows = data?.pages.flatMap(({ items }) => items);

  // Highlight mode counts matches over all tasks, not the loaded rows: the filtered query's total, the cache entry filter
  // mode reads. Same page size on purpose, since the table key leaves out the limit.
  const matchOptions = optionsFor({ ...search, q: effectiveQ });
  // biome-ignore lint/suspicious/noExplicitAny: union of query options with different key shapes
  useInfiniteQuery({ ...(matchOptions as any), enabled: highlight });
  const total = useListQueryTotal(highlight ? matchOptions.queryKey : queryOptions.queryKey);

  const isOnline = useOnlineManager();
  const rows = isOnline || highlight ? fetchedRows : fetchedRows?.filter((row) => matchesBoardSearch(search, row));

  // Tint matches among the loaded rows in highlight mode (search-filter strips the marker)
  const rowClass = highlight ? (row: Task) => (matchesBoardSearch(search, row) ? searchHighlightRowClass : undefined) : undefined;

  // isFetching includes a next-page fetch
  const fetchMore = async () => {
    if (!hasNextPage || isLoading || isFetching) return;
    await fetchNextPage();
  };

  const selectedProjectId = selected[0]?.projectId;

  const handleSelectedRowsChange = (value: Set<string>) => {
    if (!rows) return;
    const picked = rows.filter((row) => value.has(row.id));
    // Select-all from an empty selection spans projects; keep the top row's project
    const projectId = selectedProjectId ?? picked[0]?.projectId;
    setSelected(picked.filter((row) => row.projectId === projectId));
  };

  const selectedRowIds = new Set(selected.map((task) => task.id));

  const isRowSelectionDisabled = (row: Task) => isProjectReadOnly(row.projectId) || (!!selectedProjectId && row.projectId !== selectedProjectId);

  const noRowsComponent = <ContentPlaceholder icon={BirdIcon} title="c:no_resource_yet" titleOptions={{ resource: t('c:task_other') }} />;

  return (
    <TaskSearchScope>
      <div className="flex h-full flex-col gap-4">
        <TasksTableBar
          total={total}
          hasQuery={!!effectiveQ}
          selected={selected}
          searchVars={effectiveSearch}
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
            rowKeyGetter: rowKeyById,
            columns,
            enableVirtualization: true,
            enableStickyHeader: true,
            limit: tableLimit,
            error,
            isLoading,
            isFetching,
            isFiltered: !highlight && !!q,
            hasNextPage,
            fetchMore,
            rowClass,
            selectedRows: selectedRowIds,
            onSelectedRowsChange: handleSelectedRowsChange,
            isRowSelectionDisabled,
            isCompact,
            sortColumns,
            onSortColumnsChange,
            NoRowsComponent: noRowsComponent,
          }}
        />
      </div>
    </TaskSearchScope>
  );
}
