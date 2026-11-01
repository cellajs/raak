import { type PageTab, PageTabNav } from '~/modules/common/page/tab-nav';
import { useStatusTabList } from '~/modules/task/board/board-hooks';
import { statusesBottomUp } from '~/modules/task/helpers/board-helpers';
import { isBoardSearchActive } from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { statusOptionsByValue } from '~/modules/task/task-properties';

const tabs: PageTab[] = [
  // Exact: a partial match on an empty search would hold on every tab
  { id: 'all', label: 'c:all', path: '.', activeOptions: { exact: true, includeSearch: true } },
  ...statusesBottomUp.map((status): PageTab => {
    const name = statusOptionsByValue[status].status;
    return { id: name, label: `c:${name}`, path: '.', search: { statusTab: name }, activeOptions: { exact: false, includeSearch: true } };
  }),
];

/** Status tabs of the mobile project board, also drawn by its skeleton so the bar does not shift when the board loads. A search spans every status, so it hides them. */
export function StatusTabNav() {
  const search = useBoardSearch();
  const statuses = useStatusTabList();

  if (isBoardSearchActive(search)) return null;

  return <PageTabNav fallbackToFirst={!statuses} tabs={tabs} className="max-sm:border-t" />;
}
