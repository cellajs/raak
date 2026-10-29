import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TableCount } from '~/modules/common/data-table/table-count';
import type { BaseTableBarProps } from '~/modules/common/data-table/types';
import { ViewMenu } from '~/modules/common/data-table/view-menu';
import { DropdownToggleItem } from '~/modules/common/dropdowner/dropdown-toggle-item';
import { FocusView } from '~/modules/common/focus-view';
import { DisplayOptions } from '~/modules/task/board/display-options';
import { BoardSearch } from '~/modules/task/board-search';
import { configureForExport } from '~/modules/task/helpers/export-helpers';
import { deriveTasksQueryParams, fetchTasksForExport } from '~/modules/task/query';
import type { ResolvedTasksTableProps } from '~/modules/task/table/tasks-table';
import { TaskSelectedButtons } from '~/modules/task/task-selected-buttons';
import { taskBarClass } from '~/modules/task/task-styles';
import type { BoardSearchParams, Task } from '~/modules/task/types';

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
  const { t } = useTranslation();
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
      {!publicView && (
        <TaskSelectedButtons
          selectedTaskIds={selected.map(({ id }) => id)}
          clearSelection={clearSelection}
          organizationId={queryParams?.organizationId ?? ''}
          tenantId={queryParams?.tenantId ?? ''}
        />
      )}

      <BoardSearch isInWorkspace={!!workspace} toggleFocus={toggleSearchFocus}>
        {typeof total === 'number' && hasQuery && (
          <div className="flex items-center text-muted-foreground text-sm">
            {t('c:resource_count_found', { count: total, resource: t('c:task', { count: total }) })}
          </div>
        )}
      </BoardSearch>

      {!isSearchFocused && !hasQuery && <TableCount count={total} label="c:task" className="mr-3 max-sm:hidden" />}
      <ViewMenu
        columns={columns}
        setColumns={setColumns}
        export={{ filename: t('c:task_other'), selectedRows: configureForExport(selected, projects), fetchRows: fetchExport }}
      >
        <DropdownToggleItem checked={isCompact} onCheckedChange={setIsCompact}>
          {t('c:compact_view')}
        </DropdownToggleItem>
      </ViewMenu>

      <DisplayOptions className="max-sm:hidden" />
      <FocusView iconOnly />
    </div>
  );
}
