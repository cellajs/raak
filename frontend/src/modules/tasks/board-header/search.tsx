import { Search, XCircle } from 'lucide-react';
import { type KeyboardEventHandler, type MouseEventHandler, useContext, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useSaveInSearchParams from '~/hooks/use-save-in-search-params';
import { dispatchCustomEvent } from '~/lib/custom-events';
import { TableFilterBarContext } from '~/modules/common/data-table/table-filter-bar';
import { Input } from '~/modules/ui/input';
import { useWorkspaceStore } from '~/store/workspace';

const TasksSearch = ({ toggleFocus }: { toggleFocus: () => void }) => {
  const { t } = useTranslation();
  // Reference with `useRef` to persist the same ref object during re-renders
  const inputRef = useRef<HTMLInputElement>(null);
  const { isFilterActive } = useContext(TableFilterBarContext);
  const { selectedTasks, setSelectedTasks, searchQuery, setSearchQuery, focusedTaskId, setFocusedTaskId } = useWorkspaceStore();

  const handleClick = () => {
    if (focusedTaskId) {
      dispatchCustomEvent('changeSubtaskState', { taskId: focusedTaskId, state: 'folded' });
      setFocusedTaskId(null);
    }
    inputRef.current?.focus();
  };

  const filters = useMemo(
    () => ({
      q: searchQuery,
    }),
    [searchQuery],
  );
  useSaveInSearchParams(filters);

  const preventInputBlur: MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleKeyDown: KeyboardEventHandler = (e) => {
    if (e.key !== 'Escape' || searchQuery.length) return;
    inputRef.current?.blur();
  };

  // Focus input when filter button clicked(mobile)
  useEffect(() => {
    if (isFilterActive) inputRef.current?.focus();
  }, [isFilterActive]);

  return (
    <div className="relative flex w-full sm:min-w-44 items-center" onClick={handleClick} onFocus={toggleFocus} onKeyDown={handleKeyDown}>
      <Search size={16} onMouseDown={preventInputBlur} className="absolute left-3" style={{ opacity: `${searchQuery.length ? 1 : 0.5}` }} />
      <Input
        onFocus={toggleFocus}
        onBlur={toggleFocus}
        placeholder={t('common:placeholder.search')}
        style={{ paddingLeft: '2rem' }}
        className="h-10 w-full border-0 pr-10"
        ref={inputRef}
        value={searchQuery}
        onChange={(e) => {
          const searchValue = e.target.value;
          if (searchValue.length && selectedTasks.length) setSelectedTasks([]);
          setSearchQuery(searchValue);
        }}
      />

      <XCircle
        size={16}
        className="group-data-[search-focused=false]/tasksHeader:hidden absolute right-3 top-1/2 opacity-70 hover:opacity-100 -translate-y-1/2 cursor-pointer"
        onMouseDown={(e) => {
          if (searchQuery.length) preventInputBlur(e);
          setSearchQuery('');
        }}
      />
    </div>
  );
};

export default TasksSearch;
