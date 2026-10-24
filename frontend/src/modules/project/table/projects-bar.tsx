import { TrashIcon } from 'lucide-react';
import { useRef } from 'react';
import { TableBarButton } from '~/modules/common/data-table/table-bar-button';
import { TableBarShell, useTableBarFilters } from '~/modules/common/data-table/table-bar-shell';
import type { BaseTableBarProps } from '~/modules/common/data-table/types';
import { openDeleteDialog } from '~/modules/common/open-confirm';
import { useResolveCan } from '~/modules/entities/use-resolve-can';
import { DeleteProjects } from '~/modules/project/delete-projects';
import type { EnrichedProject, ProjectsRouteSearchParams } from '~/modules/project/types';
import { useListQueryTotal } from '~/query/basic/use-list-query-total';

export function ProjectsTableBar({
  selected,
  queryKey,
  searchVars,
  setSearch,
  columns,
  setColumns,
  clearSelection,
}: BaseTableBarProps<EnrichedProject, ProjectsRouteSearchParams>) {
  const resolveCan = useResolveCan();

  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  const total = useListQueryTotal(queryKey);
  const barFilters = useTableBarFilters({ searchVars, setSearch, clearSelection, reset: { q: '' } });

  // Bulk delete acts only on rows this user may delete; the badge shows that count when it differs from the selection.
  const deletable = selected.filter((row) => resolveCan(row.can?.project?.delete, row.createdBy));

  const confirmDelete = () =>
    openDeleteDialog({
      id: 'delete-projects',
      triggerRef: deleteButtonRef,
      resource: 'c:project',
      count: deletable.length,
      content: <DeleteProjects projects={deletable} callback={clearSelection} />,
    });

  return (
    <TableBarShell
      {...barFilters}
      {...{ searchVars, total, columns, setColumns }}
      label="c:project"
      searchName="projectSearch"
      selection={{
        count: selected.length,
        onClear: clearSelection,
        children: deletable.length > 0 && (
          <TableBarButton
            ref={deleteButtonRef}
            variant="destructive"
            onClick={confirmDelete}
            badge={deletable.length < selected.length ? deletable.length : undefined}
            icon={TrashIcon}
            label="c:delete"
          />
        ),
      }}
    />
  );
}
