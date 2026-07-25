import { DotIcon, StickyNoteIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { EditCellInput } from '~/modules/common/data-grid/cell-renderers';
import { CheckboxColumn } from '~/modules/common/data-table/checkbox-column';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { SpriteIcon } from '~/modules/common/icons/sprite-icon';
import { isLabelColorToken, labelPalette } from '~/modules/label/label-palette';
import type { LabelRow, LabelsTableVariant } from '~/modules/label/table/labels-table';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { cn } from '~/utils/cn';

export const useColumns = (variant: LabelsTableVariant = 'default') => {
  const { tenantId } = useOrganizationLayoutContext();
  const { t } = useTranslation();

  return useMemo(() => {
    const cols: ColumnOrColumnGroup<LabelRow>[] = [
      CheckboxColumn,
      {
        key: 'color',
        name: t('c:color'),
        minBreakpoint: variant === 'panel' ? undefined : 'md',
        width: 60,

        renderCell: ({ row }) =>
          row.icon ? (
            // Epics (and any label carrying an icon) render their icon, palette-tinted
            <div className="flex w-full justify-center">
              <SpriteIcon
                name={row.icon}
                className={cn('icon-lg', isLabelColorToken(row.color) && labelPalette[row.color].icon)}
              />
            </div>
          ) : (
            <div className="flex w-full justify-center">
              <DotIcon className="size-5.5 rounded-md" style={{ background: row.color || undefined }} strokeWidth={0} />
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
        name: t('c:task_other'),
        minWidth: 50,
        sortable: true,
        renderCell: ({ row }) => (
          <>
            <StickyNoteIcon className="mr-2 shrink-0 opacity-50" />
            {(row.usedCount ?? 0).toString()}
          </>
        ),
      },
      {
        key: 'projects',
        name: t('c:project_other'),
        // Hidden by default in the narrow board panel (toggleable via column view)
        hidden: variant === 'panel',
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
  }, [variant]);
};
