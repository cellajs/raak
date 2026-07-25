import { useInfiniteQuery } from '@tanstack/react-query';
import { BirdIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import type { SortColumn } from '~/modules/common/data-grid';
import { DataTable } from '~/modules/common/data-table/data-table';
import { groupLabelRows } from '~/modules/label/group-labels';
import { labelsQueryOptions } from '~/modules/label/query';
import { useColumns } from '~/modules/label/table/labels-columns';
import type { LabelRow, LabelsScopeProps } from '~/modules/label/types';

/** Stable row key getter function - defined outside component to prevent re-renders */
function rowKeyGetter(row: LabelRow) {
  return row.id;
}

/**
 * Compact labels list for the labels board panel. Rows open the label page (via the
 * labelPageId search param); the shared board search `q` filters labels (name + keywords)
 * and tasks simultaneously.
 */
const LabelsTable = ({ entity, entityId }: LabelsScopeProps) => {
  const { t } = useTranslation();

  const { organization, tenantId } = useOrganizationLayoutContext();
  const organizationId = organization.id;

  // Shared board search: written by the board search input, read here to filter labels too
  const { search } = useSearchParams<{ q?: string }>({});
  const q = search.q ?? '';

  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const { sort, order } = useMemo(() => {
    const [current] = sortColumns;
    if (!current) return { sort: undefined, order: undefined };
    return {
      sort: current.columnKey as 'name' | 'usedCount',
      order: current.direction === 'ASC' ? ('asc' as const) : ('desc' as const),
    };
  }, [sortColumns]);

  const columns = useColumns();

  const queryOptions = labelsQueryOptions({
    ...(entity === 'workspace' ? { workspaceId: entityId } : { projectId: entityId }),
    organizationId,
    tenantId,
    // The panel handles free-form tags and epics; primary labels are managed via org
    // settings (setupConfig).
    modes: 'secondary,epic',
    q,
    sort,
    order,
  });

  const {
    data: fetchedRows,
    isLoading,
    isFetching,
    error,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    ...queryOptions,
    select: ({ pages }) => pages.flatMap(({ items }) => items),
  });

  const rows = useMemo(() => groupLabelRows(fetchedRows ?? []), [fetchedRows]);

  const fetchMore = async () => {
    if (!hasNextPage || isLoading || isFetching) return;
    await fetchNextPage();
  };

  return (
    <DataTable<LabelRow>
      {...{
        rows,
        rowHeight: 44,
        rowKeyGetter,
        columns,
        enableVirtualization: false,
        error,
        isLoading,
        isFetching,
        isFiltered: !!q,
        hasNextPage,
        fetchMore,
        hideEndIndicator: true,
        sortColumns,
        onSortColumnsChange: setSortColumns,
        NoRowsComponent: (
          <ContentPlaceholder
            icon={BirdIcon}
            title="c:no_resource_yet"
            titleProps={{ resource: t('c:label_other').toLowerCase() }}
          />
        ),
      }}
    />
  );
};

export { LabelsTable };
