import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useSearchParams } from '~/hooks/use-search-params';
import { TableCount } from '~/modules/common/data-table/table-count';
import { TableFilterBar } from '~/modules/common/data-table/table-filter-bar';
import { SearchChipsField } from '~/modules/common/search-chips/search-chips-field';
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
  /** On a workspace page; a project page has none. */
  workspaceId?: string;
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
export function BoardSearchBar({ projects, workspaceId, publicView, total, leading, controls, searchVars }: BoardSearchBarProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const search = useBoardSearch();
  const [typingWord, setTypingWord] = useState('');
  const [isFieldUsed, setIsFieldUsed] = useState(false);
  const filters = useBoardSearchFilters(workspaceId ?? projects[0]?.id ?? '', projects, typingWord, isFieldUsed, publicView);
  const {
    search: { q = '' },
    setSearch,
  } = useSearchParams<BoardSearchParams>();

  const isFiltered = isBoardSearchActive(search);
  // A phone's bar has no room to name the scope
  const label = isMobile
    ? t('c:search')
    : t('c:search_in_resource', { resource: workspaceId ? t('c:your_resource', { resource: t('c:workspace') }) : t('c:project') });
  const foundCount = isFiltered && total !== null ? t('c:resource_count', { count: total, resource: t('c:task', { count: total }) }) : '';
  const reset = () => setSearch({ q: '', status: undefined, type: undefined, labels: undefined });

  // No bar padding from `sm` up: --board-offset-* leaves room for the field's row alone, and more would scroll the page
  return (
    <div className="contents max-sm:*:px-2 sm:*:py-0">
      <TableFilterBar
        wideSearch
        searchInRow
        foundCount={foundCount}
        isFiltered={isFiltered}
        onResetFilters={reset}
        searchVars={searchVars}
        // The margin only with a count showing: the bar hides this on focus, so an empty one would shift the field
        count={<TableCount count={isFiltered ? null : total} label="c:task" className={cn('max-sm:hidden', !isFiltered && 'mr-3')} />}
        search={
          <div className="flex items-start gap-2">
            {leading}
            {/* On press, ahead of the click: a phone's dialog opens within that click, and its options should arrive counted */}
            <div
              className="contents"
              onPointerDown={() => setCurrentItem(null)}
              onPointerDownCapture={() => setIsFieldUsed(true)}
              onFocusCapture={() => setIsFieldUsed(true)}
            >
              <SearchChipsField
                {...filters}
                id={boardSearchInputId}
                name="boardSearch"
                label={label}
                value={q}
                count={foundCount}
                onSearch={(next, typing) => {
                  setSearch({ q: next });
                  setTypingWord(typing);
                }}
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
