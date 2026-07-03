import { useMatchRoute } from '@tanstack/react-router';
import { XCircleIcon } from 'lucide-react';
import { type KeyboardEventHandler, type MouseEventHandler, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '~/hooks/use-debounce';
import { useSearchParams } from '~/hooks/use-search-params';
import { TableFilterBarContext } from '~/modules/common/data-table/table-filter-bar';
import { SearchSpinner } from '~/modules/common/search-spinner';
import { focusTask } from '~/modules/task/helpers/focus-task';
import { Badge } from '~/modules/ui/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/modules/ui/input-group';

interface Props {
  children?: React.ReactNode;
  clearSelection: () => void;
  toggleFocus: () => void;
}

export const TaskSearch = ({ children, clearSelection, toggleFocus }: Props) => {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();

  const isInWorkspace = matchRoute({ to: '/$tenantId/$organizationSlug/workspace/$slug', fuzzy: true });

  const inputRef = useRef<HTMLInputElement>(null);
  const { isFilterActive } = useContext(TableFilterBarContext);

  const {
    search: { q: searchQuery = '', matchMode = 'all' },
    setSearch,
  } = useSearchParams<{ q?: string; matchMode?: 'all' | 'any' }>({});

  const [inputValue, setInputValue] = useState(searchQuery);

  const debouncedQuery = useDebounce(inputValue, 250);

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
    if (e.key !== 'Escape') return;

    if (inputValue) {
      setInputValue('');
      setSearch({ q: '' });
    } else inputRef.current?.blur();
  };

  const toggleSearchMode = () => setSearch({ matchMode: matchMode === 'all' ? 'any' : 'all' });

  // Update parent query only when debouncedQuery changes
  useEffect(() => {
    if (debouncedQuery !== searchQuery) setSearch({ q: debouncedQuery });
  }, [debouncedQuery]);

  // Focus input when filter button clicked (mobile)
  useEffect(() => {
    if (isFilterActive) inputRef.current?.focus();
  }, [isFilterActive]);

  // // Keep input value in sync with searchQuery when it changes externally
  useEffect(() => {
    if (searchQuery !== inputValue) setInputValue(searchQuery);
  }, [searchQuery]);

  return (
    <InputGroup
      className="relative flex w-full items-center border-none shadow-none sm:min-w-44"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <InputGroupAddon className="pl-1.5">
        <SearchSpinner value={inputValue} isSearching={false} />
      </InputGroupAddon>

      <InputGroupInput
        ref={inputRef}
        name="tasksSearch"
        onFocus={toggleFocus}
        onBlur={toggleFocus}
        placeholder={t('c:search_in_resource', {
          resource: isInWorkspace
            ? t('c:your_resource', { resource: t('c:workspace').toLowerCase() })
            : t('c:project').toLowerCase(),
        })}
        className={'h-10 w-full border-0 pl-0! shadow-none'}
        value={inputValue}
        onChange={(e) => {
          const searchValue = e.target.value;
          if (searchValue.length) clearSelection();
          setInputValue(searchValue);
        }}
      />

      <InputGroupAddon className="pr-2" align="inline-end">
        {children}
      </InputGroupAddon>
      <InputGroupAddon className="pr-2" align="inline-end">
        <Badge
          variant="plain"
          size="micro"
          className={`${(!inputValue || !/\s/.test(inputValue)) && 'hidden'} cursor-pointer opacity-70 hover:opacity-100`}
          onClick={toggleSearchMode}
        >
          {matchMode}
        </Badge>
      </InputGroupAddon>
      <InputGroupAddon className="pr-2" align="inline-end">
        <XCircleIcon
          id="search-close"
          size={16}
          className={`${!inputValue && 'hidden'} cursor-pointer opacity-70 hover:opacity-100`}
          onMouseDown={(e) => {
            preventInputBlur(e);

            if (inputValue) {
              setSearch({ q: '', matchMode: undefined });
              setInputValue('');
            } else inputRef.current?.blur();
          }}
        />
      </InputGroupAddon>
    </InputGroup>
  );
};
