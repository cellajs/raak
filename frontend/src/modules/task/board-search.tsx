import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react';
import { type FocusEvent, type KeyboardEventHandler, type MouseEventHandler, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useDebounce } from '~/hooks/use-debounce';
import { useSearchParams } from '~/hooks/use-search-params';
import { TableFilterBarContext } from '~/modules/common/data-table/table-filter-bar';
import { useMatchSteps } from '~/modules/common/match-highlight/use-match-steps';
import { SearchClearButton, SearchCloseButton } from '~/modules/common/search-clear-button';
import { SearchSpinner } from '~/modules/common/search-spinner';
import { setCurrentItem } from '~/modules/task/helpers/focus-item';
import { boardSearchDefaults } from '~/modules/task/search-params-schemas';
import type { BoardSearchParams } from '~/modules/task/types';
import { Badge } from '~/modules/ui/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/modules/ui/input-group';
import { cn } from '~/utils/cn';
import { tw } from '~/utils/tw';

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

const iconButtonClass = tw('focus-effect flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-muted');

export function BoardSearch({ children, isInWorkspace, toggleFocus, matches }: BoardSearchProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');

  const inputRef = useRef<HTMLInputElement>(null);
  const { isFilterActive } = useContext(TableFilterBarContext);

  const {
    search: { q: searchQuery = boardSearchDefaults.q, matchMode = boardSearchDefaults.matchMode },
    setSearch,
  } = useSearchParams<Pick<BoardSearchParams, 'q' | 'matchMode'>>();

  const [inputValue, setInputValue] = useState(searchQuery);
  const [isFocused, setIsFocused] = useState(false);

  const debouncedQuery = useDebounce(inputValue, 250);

  const steps = useMatchSteps(matches?.ids ?? [], matches?.onStep ?? noStep, matches?.currentId);
  const canStep = !!matches?.onStep && steps.total > 0;

  const handleClick: MouseEventHandler = (event) => {
    if (event.target instanceof HTMLElement && event.target.id === 'search-close' && document.activeElement !== inputRef.current) {
      inputRef.current?.focus();
    }

    setCurrentItem(null);
  };

  const preventInputBlur: MouseEventHandler = (event) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const handleKeyDown: KeyboardEventHandler = (event) => {
    if (event.key === 'Enter' && canStep) {
      event.preventDefault();
      if (event.shiftKey) steps.previous();
      else steps.next();
      return;
    }
    if (event.key !== 'Escape') return;

    if (inputValue) {
      setInputValue('');
      setSearch({ q: '' });
    } else inputRef.current?.blur();
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
    if (debouncedQuery !== searchQuery) setSearch({ q: debouncedQuery });
  }, [debouncedQuery]);

  useEffect(() => {
    if (isFilterActive) inputRef.current?.focus();
  }, [isFilterActive]);

  useEffect(() => {
    if (searchQuery !== inputValue) setInputValue(searchQuery);
  }, [searchQuery]);

  const searchLabel = t('c:search_in_resource', {
    resource: isInWorkspace ? t('c:your_resource', { resource: t('c:workspace').toLowerCase() }) : t('c:project').toLowerCase(),
  });

  return (
    <div className="contents" onFocus={handleFocus} onBlur={handleBlur}>
      <InputGroup className="border-none shadow-none sm:min-w-44" onClick={handleClick} onKeyDown={handleKeyDown}>
        <InputGroupAddon className="pl-1.5">
          <SearchSpinner value={inputValue} isSearching={false} />
        </InputGroupAddon>

        <InputGroupInput
          ref={inputRef}
          id={boardSearchInputId}
          name="boardSearch"
          placeholder={isMobile ? t('c:placeholder.search') : searchLabel}
          aria-label={searchLabel}
          className="pl-0!"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />

        {inputValue && (
          <InputGroupAddon className="gap-1 pr-2 has-[>button]:mr-0" align="inline-end">
            {canStep && steps.index >= 0 ? (
              <span className="mr-1 text-muted-foreground text-sm tabular-nums">
                {t('c:match_position', { current: steps.index + 1, total: steps.total })}
              </span>
            ) : (
              children
            )}
            {/* Too cramped on phones, where stepping is left to Enter */}
            {canStep && (
              <div className="flex items-center max-sm:hidden">
                <button
                  type="button"
                  aria-label={t('c:previous')}
                  className={iconButtonClass}
                  onMouseDown={preventInputBlur}
                  onClick={steps.previous}
                >
                  <ChevronUpIcon className="size-4" />
                </button>
                <button type="button" aria-label={t('c:next')} className={iconButtonClass} onMouseDown={preventInputBlur} onClick={steps.next}>
                  <ChevronDownIcon className="size-4" />
                </button>
              </div>
            )}
            {/* Phones show it only for 'any': otherwise a non-default mode from a shared link would be in effect unseen */}
            {/\s/.test(inputValue) && (
              <button
                type="button"
                className={cn('focus-effect rounded-full', matchMode === 'all' && 'max-sm:hidden')}
                onMouseDown={preventInputBlur}
                onClick={toggleSearchMode}
              >
                <Badge variant="plain" size="micro" className="cursor-pointer">
                  {matchMode}
                </Badge>
              </button>
            )}
            <SearchClearButton
              id="search-close"
              onMouseDown={preventInputBlur}
              onClick={() => {
                setSearch({ q: '', matchMode: undefined });
                setInputValue('');
                inputRef.current?.focus();
              }}
            />
          </InputGroupAddon>
        )}
        <span className="sr-only" aria-live="polite">
          {steps.announcement}
        </span>
      </InputGroup>
      {/* On a phone the focused field fills the header and the close X stands beside it, apart from the clear X inside */}
      {isMobile && isFocused && (
        <div className="flex h-10 shrink-0 items-center border-l pl-1.5">
          <SearchCloseButton onMouseDown={preventInputBlur} onClick={closeSearch} />
        </div>
      )}
    </div>
  );
}
