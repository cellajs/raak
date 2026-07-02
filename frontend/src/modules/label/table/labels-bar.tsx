import { TrashIcon, XSquareIcon } from 'lucide-react';
import { ColumnsView } from '~/modules/common/data-table/columns-view';
import { TableBarButton } from '~/modules/common/data-table/table-bar-button';
import { TableBarContainer } from '~/modules/common/data-table/table-bar-container';
import { TableCount } from '~/modules/common/data-table/table-count';
import { FilterBarActions, FilterBarSearch, TableFilterBar } from '~/modules/common/data-table/table-filter-bar';
import { TableSearch } from '~/modules/common/data-table/table-search';
import type { BaseTableBarProps } from '~/modules/common/data-table/types';
import { type Label, useLabelDeleteMutation } from '~/modules/label/query';
import type { LabelRow, LabelsEntityType, LabelsSearch } from '~/modules/label/table/labels-table';
import { useInfiniteQueryTotal } from '~/query/basic/use-infinite-query-total';

type LabelsTableBarProps = { entity: LabelsEntityType } & Omit<
  BaseTableBarProps<LabelRow, LabelsSearch>,
  'selected'
> & {
    selectedLabels: Label[];
    organizationId: string;
    tenantId: string;
  };

export const LabelsTableBar = ({
  queryKey,
  selectedLabels,
  searchVars,
  setSearch,
  columns,
  setColumns,
  clearSelection,
  organizationId,
  tenantId,
}: LabelsTableBarProps) => {
  const total = useInfiniteQueryTotal(queryKey);

  const { q } = searchVars;

  const isFiltered = !!q;
  // Drop selected rows on search
  const onSearch = (searchString: string) => {
    setSearch({ q: searchString });
    clearSelection();
  };

  const onResetFilters = () => {
    setSearch({ q: '' });
    clearSelection();
  };

  const deleteLabels = useLabelDeleteMutation(tenantId, organizationId);
  const removeLabel = () => {
    deleteLabels.mutateAsync(selectedLabels).then(() => clearSelection());
  };

  return (
    <TableBarContainer searchVars={searchVars}>
      <TableFilterBar onResetFilters={onResetFilters} isFiltered={isFiltered}>
        <FilterBarActions>
          {selectedLabels.length > 0 ? (
            <>
              <TableBarButton
                variant="destructive"
                onClick={removeLabel}
                className="relative"
                badge={selectedLabels.length}
                icon={TrashIcon}
                label="c:remove"
              />
              <TableBarButton variant="ghost" onClick={clearSelection} icon={XSquareIcon} label="c:clear" />
            </>
          ) : (
            <TableCount count={total} label="c:label" isFiltered={isFiltered} onResetFilters={onResetFilters} />
          )}
        </FilterBarActions>
        <div className="sm:grow" />
        <FilterBarSearch>
          <TableSearch name="labelSearch" value={q} setQuery={onSearch} />
        </FilterBarSearch>
      </TableFilterBar>

      <ColumnsView className="max-lg:hidden" columns={columns} setColumns={setColumns} />
    </TableBarContainer>
  );
};
