import { type FocusEvent, type MouseEventHandler, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useSearchParams } from '~/hooks/use-search-params';
import { TableFilterBarContext } from '~/modules/common/data-table/table-filter-bar';
import { SearchCloseButton } from '~/modules/common/search-clear-button';
import { SearchField } from '~/modules/common/search-field';
import { setCurrentItem } from '~/modules/task/helpers/focus-item';
import { boardSearchDefaults } from '~/modules/task/search-params-schemas';
import type { BoardSearchParams } from '~/modules/task/types';

/** The input's DOM id, for the find hotkey. */
export const boardSearchInputId = 'board-search-input';

interface BoardSearchProps {
  isInWorkspace?: boolean;
  toggleFocus: () => void;
  /** The tasks the search finds, shown in the field while it holds a query. */
  total?: number | null;
}

export function BoardSearch({ isInWorkspace, toggleFocus, total }: BoardSearchProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');

  const inputRef = useRef<HTMLInputElement>(null);
  const { isFilterActive } = useContext(TableFilterBarContext);

  const {
    search: { q: searchQuery = boardSearchDefaults.q },
    setSearch,
  } = useSearchParams<Pick<BoardSearchParams, 'q'>>();

  const [isFocused, setIsFocused] = useState(false);

  const preventInputBlur: MouseEventHandler = (event) => {
    event.stopPropagation();
    event.preventDefault();
  };

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
        onSearch={(q) => setSearch({ q })}
      >
        {typeof total === 'number' && (
          <div className="flex items-center whitespace-nowrap text-muted-foreground text-sm">
            {t('c:resource_count', { count: total, resource: t('c:task', { count: total }) })}
          </div>
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
