import { DotIcon, StickyNoteIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { EditCellInput } from '~/modules/common/data-grid/cell-renderers';
import { CheckboxColumn } from '~/modules/common/data-table/checkbox-column';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import type { LabelRow } from '~/modules/label/table/labels-table';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';

export const useColumns = () => {
  const { tenantId } = useOrganizationLayoutContext();
  const { t } = useTranslation();

  return useMemo(() => {
    const cols: ColumnOrColumnGroup<LabelRow>[] = [
      CheckboxColumn,
      {
        key: 'color',
        name: t('c:color'),
        minBreakpoint: 'md',
        width: 60,

        renderCell: ({ row }) => (
          <div className="flex w-full justify-center">
            <DotIcon className="rounded-md" size={22} style={{ background: row.color || undefined }} strokeWidth={0} />
          </div>
        ),
      },
      {
        key: 'name',
        name: t('c:name'),
        minWidth: 160,
        sortable: true,
        resizable: true,
        editable: true,
        renderCell: ({ row }) => t(row.name),
        renderEditCell: ({ row, onRowChange }) => (
          <EditCellInput value={row.name} onChange={(e) => onRowChange({ ...row, name: e.target.value })} autoFocus />
        ),
      },
      {
        key: 'usedCount',
        name: t('c:tasks'),
        minWidth: 50,
        sortable: true,
        renderCell: ({ row }) => (
          <>
            <StickyNoteIcon className="mr-2 shrink-0 opacity-50" size={16} />
            {(row.usedCount ?? 0).toString()}
          </>
        ),
      },
      {
        key: 'projects',
        name: t('c:projects'),

        minBreakpoint: 'sm',
        width: 120,
        placeholderValue: '-',
        renderCell: ({ row }) => {
          const childProjects = row.projectIds
            .map((id) => findProjectByIdOrSlug(id, tenantId))
            .filter((p): p is NonNullable<typeof p> => !!p);
          if (!childProjects.length) return null;
          return (
            <AvatarGroup limit={3}>
              <AvatarGroupList>
                {childProjects.map((project) => (
                  <EntityAvatar
                    type="project"
                    key={project.id}
                    id={project.id}
                    name={project.name}
                    url={project.thumbnailUrl}
                    className="h-8 w-8 text-xs"
                  />
                ))}
              </AvatarGroupList>
              <AvatarOverflowIndicator className="h-8 w-8 text-xs" />
            </AvatarGroup>
          );
        },
      },
    ];
    return cols;
  }, []);
};
