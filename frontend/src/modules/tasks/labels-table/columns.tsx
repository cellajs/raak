import { Dot, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpoints } from '~/hooks/use-breakpoints';
import CheckboxColumn from '~/modules/common/data-table/checkbox-column';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/columns-view';
import HeaderCell from '~/modules/common/data-table/header-cell';
import { badgeStyle } from '~/modules/tasks/task-dropdowns/select-labels';
import type { Label } from '~/types/app';
import { dateShort } from '~/utils/date-short';

export const useColumns = () => {
  const { t } = useTranslation();
  const isMobile = useBreakpoints('max', 'sm');

  const columns: ColumnOrColumnGroup<Label>[] = [
    CheckboxColumn,
    {
      key: 'name',
      name: t('common:name'),
      visible: true,
      minWidth: 200,
      sortable: true,
      renderHeaderCell: HeaderCell,
      renderCell: ({ row }) => t(row.name),
    },
    {
      key: 'color',
      name: t('common:color'),
      visible: !isMobile,
      width: 100,
      sortable: false,
      renderHeaderCell: HeaderCell,
      renderCell: ({ row }) => <Dot className="rounded-md" size={22} style={badgeStyle(row.color)} strokeWidth={0} />,
    },
    {
      key: 'useCount',
      name: t('app:tasks'),
      visible: true,
      width: 100,
      sortable: true,
      renderHeaderCell: HeaderCell,
      renderCell: ({ row }) => {
        const color = (isMobile && row.color) || undefined;
        return (
          <>
            <StickyNote color={color} className="mr-2 opacity-50" size={16} />
            {row.useCount.toString()}
          </>
        );
      },
    },
    {
      key: 'lastUsedAt',
      name: t('app:last_used'),
      sortable: true,
      visible: !isMobile,
      renderHeaderCell: HeaderCell,
      renderCell: ({ row }) => dateShort(row.lastUsedAt.toString()),
    },
  ];

  return useState<ColumnOrColumnGroup<Label>[]>(columns);
};
