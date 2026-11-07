import { useTranslation } from 'react-i18next';
import type { RenderCellProps } from '~/modules/common/data-grid';
import type { ColumnOrColumnGroup } from '~/modules/common/data-table/types';
import type { Member } from '~/modules/memberships/types';
import { SampleBadge } from '~/modules/sample/sample-badge';
import { isSamplePerson } from '~/modules/sample/sample-content';
import { UserCell } from '~/modules/user/user-cell';

// No email: a search that matched only the placeholder address shows nothing under the name
function SampleMemberName({ row, tabIndex }: Pick<RenderCellProps<Member>, 'row' | 'tabIndex'>) {
  return (
    <div className="flex h-full min-w-0 items-center gap-2">
      <UserCell user={row} tabIndex={tabIndex} className="w-auto min-w-0 font-medium" />
      <SampleBadge />
    </div>
  );
}

function SampleMemberEmail() {
  const { t } = useTranslation();
  return t('c:sample');
}

/** The members table's columns with the sample team marked: a Sample badge after the name, and Sample for the placeholder address. */
export const markSampleMembers = (columns: ColumnOrColumnGroup<Member>[]): ColumnOrColumnGroup<Member>[] =>
  columns.map((column) => {
    if ('children' in column || !column.renderCell || (column.key !== 'name' && column.key !== 'email')) return column;
    const { key, renderCell } = column;
    return {
      ...column,
      renderCell: (props: RenderCellProps<Member>) => {
        if (!isSamplePerson(props.row.id)) return renderCell(props);
        return key === 'name' ? <SampleMemberName row={props.row} tabIndex={props.tabIndex} /> : <SampleMemberEmail />;
      },
    };
  });
