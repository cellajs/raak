import { Link } from '@tanstack/react-router';
import { FlagIcon, StickyNoteIcon, TagIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import { LabelFilterButton } from '~/modules/label/label-filter';
import type { LabelRow } from '~/modules/label/types';

export const useColumns = () => {
  const { t } = useTranslation();

  return useMemo(() => {
    const cols: ColumnOrColumnGroup<LabelRow>[] = [
      {
        // Mode marker: tags vs epics. Label color stays in the data model but not in the UI.
        key: 'mode',
        name: '',
        width: 44,
        renderCell: ({ row }) => (
          <div className="flex w-full justify-center">
            {row.mode === 'epic' ? (
              <FlagIcon className="icon-md opacity-70" aria-label={t('c:epic')} />
            ) : (
              <TagIcon className="icon-md opacity-50" aria-label={t('c:label')} />
            )}
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
        renderCell: ({ row, tabIndex }) => <LabelFilterButton name={row.name} size="xs" tabIndex={tabIndex} />,
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
  }, [t]);
};
