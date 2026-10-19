import { ChevronDownIcon, ChevronUpIcon, CircleXIcon, FilterIcon } from 'lucide-react';
import { type KeyboardEventHandler, type MouseEventHandler, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { useDebounce } from '~/hooks/use-debounce';
import { useSearchParams } from '~/hooks/use-search-params';
import { TableFilterBarContext } from '~/modules/common/data-table/table-filter-bar';
import { useMatchSteps } from '~/modules/common/match-highlight';
import { SearchSpinner } from '~/modules/common/search-spinner';
import { focusTask } from '~/modules/task/helpers/focus-task';
import { Badge } from '~/modules/ui/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/modules/ui/input-group';
import { cn } from '~/utils/cn';

/** The input's DOM id, for the find hotkey. */
export const boardSearchInputId = 'board-search-input';

/** The matching tasks in view order. With `onStep`, Enter and the arrow buttons walk through them. */
export type BoardSearchMatches = { ids: string[]; onStep?: (id: string) => void; currentId?: string | null };

interface BoardSearchProps {
  children?: React.ReactNode;
  isInWorkspace?: boolean;
  toggleFocus: () => void;
  matches?: BoardSearchMatches;
}

const noStep = () => {};

export function BoardSearch({ children, isInWorkspace, toggleFocus, matches }: BoardSearchProps) {
  const { t } = useTranslation();

  const inputRef = useRef<HTMLInputElement>(null);
  const { isFilterActive } = useContext(TableFilterBarContext);

  const {
    search: { q: searchQuery = '', matchMode = 'all' },
    setSearch,
  } = useSearchParams<{ q?: string; matchMode?: 'all' | 'any' }>({});

  const [inputValue, setInputValue] = useState(searchQuery);

  const debouncedQuery = useDebounce(inputValue, 250);

  const steps = useMatchSteps(matches?.ids ?? [], matches?.onStep ?? noStep, matches?.currentId);
  const canStep = !!matches?.onStep && steps.total > 0;
  const { highlight, effectiveQ } = parseSearchQuery(inputValue);

  const handleClick: MouseEventHandler = (e) => {
    const target = e.target as HTMLElement; // Cast the target to HTMLElement
    if (target.id === 'search-close' && document.activeElement !== inputRef.current) inputRef.current?.focus();

    focusTask(null);
  };

  const preventInputBlur: MouseEventHandler = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleKeyDown: KeyboardEventHandler = (e) => {
    if (e.key === 'Enter' && canStep) {
      e.preventDefault();
      if (e.shiftKey) steps.previous();
      else steps.next();
      return;
    }
    if (e.key !== 'Escape') return;

    if (inputValue) {
      setInputValue('');
      setSearch({ q: '' });
    } else inputRef.current?.blur();
  };

  const toggleSearchMode = () => setSearch({ matchMode: matchMode === 'all' ? 'any' : 'all' });

  const setHighlightMode = (on: boolean) => setInputValue(on ? `=${effectiveQ}` : effectiveQ);

  // Update parent query only when debouncedQuery changes
  useEffect(() => {
    if (debouncedQuery !== searchQuery) setSearch({ q: debouncedQuery });
  }, [debouncedQuery]);

  // Focus input when filter button clicked (mobile)
  useEffect(() => {
    if (isFilterActive) inputRef.current?.focus();
  }, [isFilterActive]);

  // Keep input value in sync with searchQuery when it changes externally
  useEffect(() => {
    if (searchQuery !== inputValue) setInputValue(searchQuery);
  }, [searchQuery]);

  const searchLabel = t('c:search_in_resource', {
    resource: isInWorkspace ? t('c:your_resource', { resource: t('c:workspace').toLowerCase() }) : t('c:project').toLowerCase(),
  });

  const iconButtonClass = 'focus-effect flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-muted';

  return (
    <InputGroup className="relative flex w-full items-center border-none shadow-none sm:min-w-44" onClick={handleClick} onKeyDown={handleKeyDown}>
      <InputGroupAddon className="pl-1.5">
        <SearchSpinner value={inputValue} isSearching={false} />
      </InputGroupAddon>

      <InputGroupInput
        ref={inputRef}
        id={boardSearchInputId}
        name="boardSearch"
        onFocus={toggleFocus}
        onBlur={toggleFocus}
        placeholder={searchLabel}
        aria-label={searchLabel}
        className={'h-10 w-full border-0 pl-0! shadow-none'}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
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
          {canStep && (
            <div className="flex items-center">
              <button type="button" aria-label={t('c:previous')} className={iconButtonClass} onMouseDown={preventInputBlur} onClick={steps.previous}>
                <ChevronUpIcon className="size-4" />
              </button>
              <button type="button" aria-label={t('c:next')} className={iconButtonClass} onMouseDown={preventInputBlur} onClick={steps.next}>
                <ChevronDownIcon className="size-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            aria-pressed={!highlight}
            aria-label={t('c:filter')}
            title={t('c:filter')}
            className={cn(iconButtonClass, 'aria-pressed:bg-success aria-pressed:text-success-foreground aria-pressed:hover:bg-success/90')}
            onMouseDown={preventInputBlur}
            onClick={() => setHighlightMode(!highlight)}
          >
            <FilterIcon className="size-3.5" />
          </button>
          {/\s/.test(inputValue) && (
            <button type="button" className="focus-effect rounded-full" onMouseDown={preventInputBlur} onClick={toggleSearchMode}>
              <Badge variant="plain" size="micro" className="cursor-pointer">
                {matchMode}
              </Badge>
            </button>
          )}
          <button
            type="button"
            id="search-close"
            aria-label={t('c:clear')}
            className={iconButtonClass}
            onMouseDown={preventInputBlur}
            onClick={() => {
              setSearch({ q: '', matchMode: undefined });
              setInputValue('');
              inputRef.current?.focus();
            }}
          >
            <CircleXIcon className="size-4" />
          </button>
        </InputGroupAddon>
      )}
      <span className="sr-only" aria-live="polite">
        {steps.announcement}
      </span>
    </InputGroup>
  );
}
