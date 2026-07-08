import { useInfiniteQuery } from '@tanstack/react-query';
import { BirdIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zGetLabelsQuery } from 'sdk/zod.gen';
import { appConfig } from 'shared';
import type { z } from 'zod';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import type { RowsChangeData } from '~/modules/common/data-grid';
import { DataTable } from '~/modules/common/data-table/data-table';
import { useSortColumns } from '~/modules/common/data-table/sort-columns';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { type Label, labelsQueryOptions, useLabelUpdateMutation } from '~/modules/label/query';
import { LabelsTableBar } from '~/modules/label/table/labels-bar';
import { useColumns } from '~/modules/label/table/labels-columns';

const LIMIT = appConfig.requestLimits.labels;

const labelsSearchSchema = zGetLabelsQuery.pick({ q: true, sort: true, order: true });
export type LabelsSearch = z.infer<typeof labelsSearchSchema>;

export type LabelsEntityType = 'project' | 'workspace';
export type BaseLabelsTableProps = { entity: LabelsEntityType; entityId: string };
export type LabelRow = Label & { siblingIds: string[]; projectIds: string[] };

/** Stable row key getter function - defined outside component to prevent re-renders */
function rowKeyGetter(row: LabelRow) {
  return row.id;
}

const LabelsTable = ({ entity, entityId }: BaseLabelsTableProps) => {
  const { t } = useTranslation();

  const { organization, tenantId } = useOrganizationLayoutContext();
  const organizationId = organization.id;

  const updateLabel = useLabelUpdateMutation(tenantId, organizationId);

  const { search, setSearch } = useSearchParams<LabelsSearch>({ saveDataInSearch: false });

  // Search query options
  const { q, sort, order } = search;
  const limit = LIMIT;

  // Build columns
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const columnsFromHook = useColumns();
  const [hiddenOverrides, setHiddenOverrides] = useState<Record<string, boolean>>({});
  const columns = useMemo(
    () =>
      columnsFromHook.map((col) => ({
        ...col,
        hidden: hiddenOverrides[col.key] ?? col.hidden,
      })),
    [columnsFromHook, hiddenOverrides],
  );
  const setColumns: React.Dispatch<React.SetStateAction<ColumnOrColumnGroup<LabelRow>[]>> = (updater) => {
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

  const queryOptions = labelsQueryOptions({
    ...(entity === 'workspace' ? { workspaceId: entityId } : { projectId: entityId }),
    organizationId,
    tenantId,
    ...search,
    limit,
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

  // Deduplicate labels by name, aggregating counts and collecting sibling IDs.
  const rows = useMemo(() => {
    if (!fetchedRows) return [];
    const labelMap = new Map<string, LabelRow>();

    for (const label of fetchedRows) {
      const existing = labelMap.get(label.name);

      if (!existing) {
        labelMap.set(label.name, { ...label, siblingIds: [label.id], projectIds: [label.projectId] });
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

  const onRowsChange = useCallback(
    (changedRows: LabelRow[], { indexes, column }: RowsChangeData<LabelRow>) => {
      if (column.key !== 'name') return;

      for (const index of indexes) {
        const label = changedRows[index];
        const original = rows.find((r) => r.id === label.id);
        if (original && label.name !== original.name) {
          // Update all sibling labels with the new name
          for (const siblingId of original.siblingIds) {
            updateLabel.mutate({ id: siblingId, ops: { name: label.name } });
          }
        }
      }
    },
    [rows, updateLabel],
  );

  const fetchMore = async () => {
    if (!hasNextPage || isLoading || isFetching) return;
    await fetchNextPage();
  };

  const onSelectedRowsChange = (newSelected: Set<string>) => {
    if (newSelected.size === 0) {
      setSelectedIds([]);
      return;
    }

    // Selecting a row selects all its siblings (same label name across projects)
    const allIds: string[] = [];
    for (const row of rows) {
      if (newSelected.has(row.id)) {
        allIds.push(...row.siblingIds);
      }
    }
    setSelectedIds(allIds);
  };

  const selectedRows = useMemo(() => {
    if (!rows.length || !selectedIds.length) return new Set<string>();

    const selectedIdSet = new Set(selectedIds);
    const result = new Set<string>();

    for (const row of rows) {
      if (selectedIdSet.has(row.id) || row.siblingIds.every((id) => selectedIdSet.has(id))) {
        result.add(row.id);
      }
    }

    return result;
  }, [rows, selectedIds]);

  const clearSelection = () => setSelectedIds([]);

  return (
    <>
      <LabelsTableBar
        selectedLabels={fetchedRows?.filter((label) => selectedIds.includes(label.id)) ?? []}
        columns={columns}
        setColumns={setColumns}
        searchVars={{ ...search, limit }}
        setSearch={setSearch}
        clearSelection={clearSelection}
        entity={entity}
        queryKey={queryOptions.queryKey}
        organizationId={organizationId}
        tenantId={tenantId}
      />
      <DataTable<LabelRow>
        {...{
          rows,
          rowHeight: 52,
          onRowsChange,
          rowKeyGetter,
          columns,
          enableVirtualization: false,
          limit,
          error,
          isLoading,
          isFetching,
          isFiltered: !!q,
          hasNextPage,
          fetchMore,
          selectedRows,
          onSelectedRowsChange,
          sortColumns,
          onSortColumnsChange,
          NoRowsComponent: (
            <ContentPlaceholder
              icon={BirdIcon}
              title="c:no_resource_yet"
              titleProps={{ resource: t('c:label_other').toLowerCase() }}
            />
          ),
        }}
      />
    </>
  );
};

export { LabelsTable };
