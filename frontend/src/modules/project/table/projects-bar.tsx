import { TrashIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveCan } from 'shared';
import { TableBarButton } from '~/modules/common/data-table/table-bar-button';
import { TableBarShell, useTableBarFilters } from '~/modules/common/data-table/table-bar-shell';
import type { BaseTableBarProps } from '~/modules/common/data-table/types';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { NamedText } from '~/modules/common/named-text';
import { DeleteProjects } from '~/modules/project/delete-projects';
import type { EnrichedProject, ProjectsRouteSearchParams } from '~/modules/project/types';
import { useUserStore } from '~/modules/user/user-store';
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
  const { t } = useTranslation();
  const createDialog = useDialoger((state) => state.create);
  const userId = useUserStore((state) => state.user?.id);

  const deleteButtonRef = useRef(null);

  const total = useListQueryTotal(queryKey);
  const barFilters = useTableBarFilters({ searchVars, setSearch, clearSelection, reset: { q: '' } });

  const resourceOf = (count: number) => (count > 1 ? t('c:project_other') : t('c:project')).toLowerCase();

  // Bulk delete acts only on rows this user may delete; the badge shows that count when it differs from the selection.
  const deletable = selected.filter((row) => resolveCan(row.can?.project?.delete, row.createdBy?.id ?? null, userId));

  const openDeleteDialog = () => {
    createDialog(<DeleteProjects dialog projects={deletable} callback={clearSelection} />, {
      id: 'delete-projects',
      triggerRef: deleteButtonRef,
      className: 'max-w-xl',
      title: t('c:delete_resource', { resource: resourceOf(deletable.length) }),
      description: (
        <NamedText i18nKey="c:confirm.delete_counted_resource" values={{ count: deletable.length, resource: resourceOf(deletable.length) }} />
      ),
    });
  };

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
            onClick={openDeleteDialog}
            className="relative"
            badge={deletable.length < selected.length ? deletable.length : undefined}
            icon={TrashIcon}
            label="c:delete"
          />
        ),
      }}
    />
  );
}
