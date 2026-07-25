import { useInfiniteQuery } from '@tanstack/react-query';
import { BirdIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import type { SortColumn } from '~/modules/common/data-grid';
import { DataTable } from '~/modules/common/data-table/data-table';
import { type Label, labelsQueryOptions } from '~/modules/label/query';
import { useColumns } from '~/modules/label/table/labels-columns';

/** Stable row key getter function - defined outside component to prevent re-renders */
function rowKeyGetter(row: LabelRow) {
  return row.id;
}

export type LabelsEntityType = 'project' | 'workspace';
export type BaseLabelsTableProps = { entity: LabelsEntityType; entityId: string };
export type LabelRow = Label & { siblingIds: string[]; projectIds: string[] };

/**
 * Compact labels list for the labels board panel. Rows open the label page (via the
 * labelPageId search param); the shared board search `q` filters labels (name + keywords)
 * and tasks simultaneously.
 */
const LabelsTable = ({ entity, entityId }: BaseLabelsTableProps) => {
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

  // Deduplicate secondary labels by name, aggregating counts and collecting sibling IDs.
  // Epics are concrete per-project rows and never group across projects.
  const rows = useMemo(() => {
    if (!fetchedRows) return [];
    const labelMap = new Map<string, LabelRow>();

    for (const label of fetchedRows) {
      const groupKey = label.mode === 'epic' ? label.id : label.name;
      const existing = labelMap.get(groupKey);

      if (!existing) {
        labelMap.set(groupKey, { ...label, siblingIds: [label.id], projectIds: [label.projectId] });
      } else {
        existing.usedCount = (existing.usedCount ?? 0) + (label.usedCount ?? 0);
        existing.siblingIds = [...existing.siblingIds, label.id];
        if (!existing.projectIds.includes(label.projectId)) {
          existing.projectIds = [...existing.projectIds, label.projectId];
        }
      }
    }

    return Array.from(labelMap.values());
  }, [fetchedRows]);

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
