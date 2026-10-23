import { BirdIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { DataTable } from '~/modules/common/data-table/data-table';
import { useSortColumns } from '~/modules/common/data-table/sort-columns';
import { useInfiniteRows } from '~/modules/common/data-table/use-infinite-rows';
import { useRowSelection } from '~/modules/common/data-table/use-row-selection';
import type { EnrichedOrganization } from '~/modules/organization/types';
import { projectsListQueryOptions } from '~/modules/project/query';
import { ProjectsTableBar } from '~/modules/project/table/projects-bar';
import { useColumns } from '~/modules/project/table/projects-columns';
import type { EnrichedProject, ProjectsRouteSearchParams } from '~/modules/project/types';

function rowKeyGetter(row: EnrichedProject) {
  return row.id;
}

interface ProjectsTableProps {
  organization: EnrichedOrganization;
}

/** Every project of an organization the user may read, whether or not they are a member of it. */
export function ProjectsTable({ organization }: ProjectsTableProps) {
  const { t } = useTranslation();

  const { search, setSearch } = useSearchParams<ProjectsRouteSearchParams>({ from: '/_app/$tenantId/$organizationSlug/organization/projects' });

  const { q, sort, order } = search;

  const [columns, setColumns] = useColumns(organization);
  const { sortColumns, setSortColumns: onSortColumnsChange } = useSortColumns(sort, order, setSearch);

  const queryOptions = projectsListQueryOptions({ ...search, organizationId: organization.id, scope: 'organization', include: 'counts' });

  const { rows, isLoading, isFetching, error, hasNextPage, fetchMore } = useInfiniteRows(queryOptions);
  const { selected, selectedRowIds, onSelectedRowsChange, clearSelection } = useRowSelection(rows);

  return (
    <>
      <ProjectsTableBar
        queryKey={queryOptions.queryKey}
        selected={selected}
        columns={columns}
        searchVars={search}
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
            <ContentPlaceholder icon={BirdIcon} title="c:no_resource_yet" titleOptions={{ resource: t('c:project_other').toLowerCase() }} />
          ),
        }}
      />
    </>
  );
}
