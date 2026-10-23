import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnsView } from '~/modules/common/data-table/columns-view';
import { Export } from '~/modules/common/data-table/export';
import { TableCount } from '~/modules/common/data-table/table-count';
import type { BaseTableBarProps } from '~/modules/common/data-table/types';
import { FocusView } from '~/modules/common/focus-view';
import { DisplayOptions } from '~/modules/task/board/display-options';
import { BoardSearch } from '~/modules/task/board-search';
import { configureForExport } from '~/modules/task/helpers/export-helpers';
import { deriveTasksQueryParams, fetchTasksForExport } from '~/modules/task/query';
import type { ResolvedTasksTableProps } from '~/modules/task/table/tasks-table';
import { TaskSelectedButtons } from '~/modules/task/task-selected-buttons';
import { taskBarClass } from '~/modules/task/task-styles';
import type { BoardSearchParams, Task } from '~/modules/task/types';
import { DropdownMenuCheckboxItem } from '~/modules/ui/dropdown-menu';

interface TasksTableBarProps
  extends Omit<BaseTableBarProps<Task, BoardSearchParams>, 'setSearch' | 'queryKey'>,
    Omit<ResolvedTasksTableProps, 'organization' | 'tenantId'> {
  total: number | null;
  /** True in highlight mode too, where `searchVars` (what the table and export fetch) carries no query. */
  hasQuery: boolean;
  isCompact: boolean;
  setIsCompact: (isCompact: boolean) => void;
}

export function TasksTableBar({
  total,
  hasQuery,
  selected,
  searchVars,
  columns,
  setColumns,
  clearSelection,
  projects,
  workspace,
  publicView,
  isCompact,
  setIsCompact,
}: TasksTableBarProps) {
  const { t, i18n } = useTranslation();
  const queryParams = publicView ? undefined : deriveTasksQueryParams(workspace, projects[0]);

  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const fetchExport = async (limit: number, offset: number) => {
    if (!queryParams) return [];
    const { organizationId, tenantId, ...rest } = queryParams;
    const tableQueryParams = { ...searchVars, ...rest };
    const items = await fetchTasksForExport({ limit, offset, organizationId, tenantId, query: tableQueryParams });
    return configureForExport(items, projects);
  };

  const toggleSearchFocus = () => setIsSearchFocused((prev) => !prev);

  return (
    <div className={taskBarClass}>
      <TaskSelectedButtons
        selectedTaskIds={selected.map(({ id }) => id)}
        clearSelection={clearSelection}
        organizationId={queryParams?.organizationId ?? ''}
        tenantId={queryParams?.tenantId ?? ''}
      />

      <BoardSearch isInWorkspace={!!workspace} toggleFocus={toggleSearchFocus}>
        {typeof total === 'number' && hasQuery && (
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <span>{new Intl.NumberFormat(i18n.language).format(total)}</span>
            <span>{t('c:found')}</span>
          </div>
        )}
      </BoardSearch>

      {!isSearchFocused && !hasQuery && <TableCount count={total} label="c:task" className="mr-3" />}
      <ColumnsView className="max-lg:hidden" columns={columns} setColumns={setColumns}>
        <DropdownMenuCheckboxItem className="min-h-8" checked={isCompact} onCheckedChange={() => setIsCompact(!isCompact)}>
          {t('c:compact_view')}
        </DropdownMenuCheckboxItem>
      </ColumnsView>
      <Export
        className="max-lg:hidden"
        filename={t('c:task_other')}
        columns={columns}
        selectedRows={configureForExport(selected, projects)}
        fetchRows={fetchExport}
      />

      <DisplayOptions className="max-sm:hidden" />
      <FocusView iconOnly />
    </div>
  );
}
