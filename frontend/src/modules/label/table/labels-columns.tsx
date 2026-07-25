import { Link } from '@tanstack/react-router';
import { DotIcon, ListFilterIcon, StickyNoteIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { SpriteIcon } from '~/modules/common/icons/sprite-icon';
import { useLabelFilterToggle } from '~/modules/label/label-filter';
import { isLabelColorToken, labelPalette } from '~/modules/label/label-palette';
import type { LabelRow } from '~/modules/label/table/labels-table';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

export const useColumns = () => {
  const { t } = useTranslation();
  const { isActive, toggle } = useLabelFilterToggle();

  return useMemo(() => {
    const cols: ColumnOrColumnGroup<LabelRow>[] = [
      {
        key: 'color',
        name: t('c:color'),
        width: 44,
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
        minWidth: 120,
        sortable: true,
        resizable: true,
        renderCell: ({ row, tabIndex }) => (
          <Link
            to="."
            replace={false}
            resetScroll={false}
            search={(prev) => ({ ...prev, labelPageId: row.id })}
            tabIndex={tabIndex}
            className="w-full truncate text-left decoration-foreground/30 underline-offset-3 outline-0 ring-0 hover:underline"
          >
            {row.name}
          </Link>
        ),
      },
      {
        key: 'filter',
        name: '',
        width: 44,
        renderCell: ({ row, tabIndex }) => (
          <Button
            variant="ghost"
            size="xs"
            tabIndex={tabIndex}
            aria-label={t('c:filter_by_resource', { resource: row.name })}
            aria-pressed={isActive(row.name)}
            onClick={() => toggle(row.name)}
            className={cn('opacity-60 hover:opacity-100', isActive(row.name) && 'text-primary opacity-100')}
          >
            <ListFilterIcon />
          </Button>
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
    ];
    return cols;
  }, [isActive, toggle, t]);
};
