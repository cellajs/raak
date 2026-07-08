import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ColumnsView } from '~/modules/common/data-table/columns-view';
import { Export } from '~/modules/common/data-table/export';
import { TableCount } from '~/modules/common/data-table/table-count';
import type { BaseTableBarProps } from '~/modules/common/data-table/types';
import { FocusView } from '~/modules/common/focus-view';
import { configureForExport } from '~/modules/task/helpers/export-helpers';
import { useTasksTotal } from '~/modules/task/hooks/use-tasks-total';
import { deriveTasksQueryParams, fetchTasksForExport } from '~/modules/task/query';
import type { ResolvedTaskTableProps } from '~/modules/task/table/tasks-table';
import { TaskSearch } from '~/modules/task/task-search';
import { TaskSelectedButtons } from '~/modules/task/task-selected-buttons';
import type { Task, TaskSearch as TaskSearchType } from '~/modules/task/types';
import { DropdownMenuCheckboxItem } from '~/modules/ui/dropdown-menu';
import { DisplayOptions } from '~/modules/workspace/header/display-options';

type TasksTableBarProps = Omit<BaseTableBarProps<Task, TaskSearchType>, 'setSearch' | 'queryKey'> &
  Omit<ResolvedTaskTableProps, 'organization' | 'tenantId'> & {
    isCompact: boolean;
    setIsCompact: (isCompact: boolean) => void;
  };

export const TasksTableBar = ({
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
}: TasksTableBarProps) => {
  const { t, i18n } = useTranslation();
  const queryParams = publicView ? undefined : deriveTasksQueryParams(workspace, projects[0]);
  const total = useTasksTotal('table', queryParams);

  const [searchFocused, setSearchFocused] = useState(false);

  const fetchExport = async (limit: number, offset: number) => {
    if (!queryParams) return [];
    const { organizationId, tenantId, ...rest } = queryParams;
    const tableQueryParams = { ...searchVars, ...rest };
    const items = await fetchTasksForExport({
      limit,
      offset,
      organizationId,
      tenantId,
      query: tableQueryParams,
    });
    return configureForExport(items, projects);
  };

  const toggleSearchFocus = () => setSearchFocused((prev) => !prev);

  return (
    <div className="z-85 flex items-center gap-2 bg-background max-sm:justify-between max-sm:p-2">
      {!searchFocused && (
        <TaskSelectedButtons
          selectedTasks={selected}
          clearSelection={clearSelection}
          organizationId={queryParams?.organizationId ?? ''}
          tenantId={queryParams?.tenantId ?? ''}
        />
      )}

      <TaskSearch clearSelection={clearSelection} toggleFocus={toggleSearchFocus}>
        {typeof total === 'number' && searchVars.q && (
          <div className="flex items-center gap-1 text-muted-foreground text-sm">
            <span>{new Intl.NumberFormat(i18n.language).format(total)}</span>
            <span>{t('c:found')}</span>
          </div>
        )}
      </TaskSearch>

      {!searchFocused && !searchVars.q && <TableCount count={total} label="c:task" className="mr-3" />}
      <ColumnsView className="max-lg:hidden" columns={columns} setColumns={setColumns}>
        <DropdownMenuCheckboxItem
          className="min-h-8"
          checked={isCompact}
          onCheckedChange={() => setIsCompact(!isCompact)}
        >
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
};
