import { BirdIcon } from 'lucide-react';
import { type Dispatch, type SetStateAction, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'shared';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { DataTable } from '~/modules/common/data-table/data-table';
import { useSortColumns } from '~/modules/common/data-table/sort-columns';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { useInfiniteRows } from '~/modules/common/data-table/use-infinite-rows';
import { useRowSelection } from '~/modules/common/data-table/use-row-selection';
import type { EnrichedOrganization } from '~/modules/organization/types';
import { projectsListQueryOptions } from '~/modules/project/query';
import { ProjectsTableBar } from '~/modules/project/table/projects-bar';
import { useColumns } from '~/modules/project/table/projects-columns';
import type { EnrichedProject, ProjectsRouteSearchParams } from '~/modules/project/types';

const LIMIT = appConfig.requestLimits.projects;

function rowKeyGetter(row: EnrichedProject) {
  return row.id;
}

interface ProjectsTableProps {
  organization: EnrichedOrganization;
}

/** Every project of an organization the user may read, whether or not they are a member of it. */
function ProjectsTable({ organization }: ProjectsTableProps) {
  const { t } = useTranslation();

  const { search, setSearch } = useSearchParams<ProjectsRouteSearchParams>({ from: '/_app/$tenantId/$organizationSlug/organization/projects' });

  const { q, sort, order } = search;
  const limit = LIMIT;

  // Columns follow the organization's grants, so only their visibility is table state.
  const columnsFromHook = useColumns(organization);
  const [hiddenOverrides, setHiddenOverrides] = useState<Record<string, boolean>>({});
  const columns = useMemo(
    () => columnsFromHook.map((col) => ({ ...col, hidden: hiddenOverrides[col.key] ?? col.hidden })),
    [columnsFromHook, hiddenOverrides],
  );
  const setColumns: Dispatch<SetStateAction<ColumnOrColumnGroup<EnrichedProject>[]>> = (updater) => {
    const newCols = typeof updater === 'function' ? updater(columns) : updater;
    setHiddenOverrides((prev) => {
      const next = { ...prev };
      for (const col of newCols) {
        if (col.hidden !== undefined) next[col.key] = col.hidden;
      }
      return next;
    });
  };
  const { sortColumns, setSortColumns: onSortColumnsChange } = useSortColumns(sort, order, setSearch);

  const queryOptions = projectsListQueryOptions({ ...search, organizationId: organization.id, scope: 'organization', limit, include: 'counts' });

  const { rows, isLoading, isFetching, error, hasNextPage, fetchMore } = useInfiniteRows(queryOptions);
  const { selected, selectedRowIds, onSelectedRowsChange, clearSelection } = useRowSelection(rows);

  return (
    <>
      <ProjectsTableBar
        queryKey={queryOptions.queryKey}
        selected={selected}
        columns={columns}
        searchVars={{ ...search, limit }}
        setSearch={setSearch}
        setColumns={setColumns}
        clearSelection={clearSelection}
      />
      <DataTable<EnrichedProject>
        {...{
          rows,
          rowHeight: 52,
          rowKeyGetter,
          columns,
          enableVirtualization: true,
          limit,
          error,
          isLoading,
          isFetching,
          isFiltered: !!q,
          hasNextPage,
          fetchMore,
          selectedRows: selectedRowIds,
          onSelectedRowsChange,
          sortColumns,
          onSortColumnsChange,
          NoRowsComponent: (
            <ContentPlaceholder icon={BirdIcon} title="c:no_resource_yet" titleProps={{ resource: t('c:project_other').toLowerCase() }} />
          ),
        }}
      />
    </>
  );
}

export { ProjectsTable };
