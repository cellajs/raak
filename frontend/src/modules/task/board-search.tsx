import { type FocusEvent, type MouseEventHandler, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useSearchParams } from '~/hooks/use-search-params';
import { TableFilterBarContext } from '~/modules/common/data-table/table-filter-bar';
import { useMatchSteps } from '~/modules/common/match-highlight/use-match-steps';
import { SearchCloseButton } from '~/modules/common/search-clear-button';
import { SearchField } from '~/modules/common/search-field';
import { setCurrentItem } from '~/modules/task/helpers/focus-item';
import { boardSearchDefaults } from '~/modules/task/search-params-schemas';
import type { BoardSearchParams } from '~/modules/task/types';
import { Badge } from '~/modules/ui/badge';
import { cn } from '~/utils/cn';

/** The input's DOM id, for the find hotkey. */
export const boardSearchInputId = 'board-search-input';

/** The matching tasks in view order. With `onStep`, Enter and the arrow buttons walk through them. */
type BoardSearchMatches = { ids: string[]; onStep?: (id: string) => void; currentId?: string | null };

interface BoardSearchProps {
  children?: ReactNode;
  isInWorkspace?: boolean;
  toggleFocus: () => void;
  matches?: BoardSearchMatches;
}

const noStep = () => {};

export function BoardSearch({ children, isInWorkspace, toggleFocus, matches }: BoardSearchProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');

  const inputRef = useRef<HTMLInputElement>(null);
  const { isFilterActive } = useContext(TableFilterBarContext);

  const {
    search: { q: searchQuery = boardSearchDefaults.q, matchMode = boardSearchDefaults.matchMode },
    setSearch,
  } = useSearchParams<Pick<BoardSearchParams, 'q' | 'matchMode'>>();

  const [isFocused, setIsFocused] = useState(false);

  const steps = useMatchSteps(matches?.ids ?? [], matches?.onStep ?? noStep, matches?.currentId);

  const preventInputBlur: MouseEventHandler = (event) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const toggleSearchMode = () => setSearch({ matchMode: matchMode === 'all' ? 'any' : 'all' });

  // Focus moving between the field and its own buttons keeps the search open, so Tab reaches the close X
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsFocused(true);
    toggleFocus();
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    setIsFocused(false);
    toggleFocus();
  };

  const closeSearch: MouseEventHandler<HTMLButtonElement> = (event) => {
    inputRef.current?.blur();
    event.currentTarget.blur();
  };

  useEffect(() => {
    if (isFilterActive) inputRef.current?.focus();
  }, [isFilterActive]);

  const searchLabel = t('c:search_in_resource', {
    resource: isInWorkspace ? t('c:your_resource', { resource: t('c:workspace') }) : t('c:project'),
  });

  return (
    <div className="contents" onFocus={handleFocus} onBlur={handleBlur} onPointerDown={() => setCurrentItem(null)}>
      <SearchField
        ref={inputRef}
        id={boardSearchInputId}
        name="boardSearch"
        label={isMobile ? t('c:placeholder.search') : searchLabel}
        className="border-none shadow-none sm:min-w-44 max-sm:[&_[data-align=inline-start]_svg]:size-5"
        value={searchQuery}
        onSearch={(q) => setSearch(q ? { q } : { q: '', matchMode: undefined })}
        steps={matches?.onStep ? steps : undefined}
      >
        {children}
        {/* Phones show it only for 'any': otherwise a non-default mode from a shared link would be in effect unseen */}
        {/\s/.test(searchQuery) && (
          <button
            type="button"
            className={cn('focus-effect rounded-full', matchMode === 'all' && 'max-sm:hidden')}
            onMouseDown={preventInputBlur}
            onClick={toggleSearchMode}
          >
            <Badge soft size="micro" className="cursor-pointer">
              {matchMode}
            </Badge>
          </button>
        )}
      </SearchField>
      {/* On a phone the focused field fills the header and the close X stands beside it, apart from the clear X inside */}
      {isMobile && isFocused && (
        <div className="flex h-10 shrink-0 items-center border-l pl-1.5">
          <SearchCloseButton onMouseDown={preventInputBlur} onClick={closeSearch} />
        </div>
      )}
    </div>
  );
}
