import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { TableCount } from '~/modules/common/data-table/table-count';
import { TableFilterBar } from '~/modules/common/data-table/table-filter-bar';
import { SearchChipsField } from '~/modules/common/search-chips-field';
import type { EnrichedProject } from '~/modules/project/types';
import { setCurrentItem } from '~/modules/task/helpers/focus-item';
import { isBoardSearchActive } from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { useBoardSearchFilters } from '~/modules/task/hooks/use-board-search-filters';
import type { BoardSearchParams } from '~/modules/task/types';
import { cn } from '~/utils/cn';

/** The input's DOM id, for the find hotkey. */
export const boardSearchInputId = 'board-search-input';

interface BoardSearchBarProps {
  /** The board's projects; their cached tasks give the filters and counts. */
  projects: Pick<EnrichedProject, 'id' | 'organizationId'>[];
  isInWorkspace?: boolean;
  publicView?: boolean;
  /** All tasks when nothing filters, else the tasks found. */
  total: number | null;
  /** Before the search, such as a create button. */
  leading?: ReactNode;
  /** The board's or table's own controls, after the count. */
  controls: ReactNode;
  /** A change scrolls the list back to the top. */
  searchVars?: Record<string, unknown>;
}

/** The search over the tasks of a board or table, shared by both views. */
export function BoardSearchBar({ projects, isInWorkspace, publicView, total, leading, controls, searchVars }: BoardSearchBarProps) {
  const { t } = useTranslation();
  const search = useBoardSearch();
  const filters = useBoardSearchFilters(projects, publicView);
  const {
    search: { q = '' },
    setSearch,
  } = useSearchParams<BoardSearchParams>();

  const isFiltered = isBoardSearchActive(search);
  const label = t('c:search_in_resource', { resource: isInWorkspace ? t('c:your_resource', { resource: t('c:workspace') }) : t('c:project') });
  const reset = () => setSearch({ q: '', status: undefined, type: undefined, labels: undefined });

  // No bar padding from `sm` up: --board-offset-* leaves room for the field's row alone, and more would scroll the page
  return (
    <div className="contents max-sm:*:px-2 sm:*:py-0">
      <TableFilterBar
        wideSearch
        isFiltered={isFiltered}
        onResetFilters={reset}
        searchVars={searchVars}
        searchLabel={label}
        // The margin only with a count showing: the bar hides this on focus, so an empty one would shift the field
        count={<TableCount count={isFiltered ? null : total} label="c:task" className={cn('max-sm:hidden', !isFiltered && 'mr-3')} />}
        search={
          <div className="flex items-start gap-2">
            {leading}
            <div className="contents" onPointerDown={() => setCurrentItem(null)}>
              <SearchChipsField
                {...filters}
                id={boardSearchInputId}
                name="boardSearch"
                label={label}
                value={q}
                count={isFiltered && total !== null ? t('c:resource_count', { count: total, resource: t('c:task', { count: total }) }) : ''}
                onSearch={(next) => setSearch({ q: next })}
                onReset={reset}
                className="edgeless"
              />
            </div>
          </div>
        }
        controls={controls}
      />
    </div>
  );
}
