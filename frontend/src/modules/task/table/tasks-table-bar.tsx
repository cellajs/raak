import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'shared';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import type { BaseTableBarProps } from '~/modules/common/data-table/types';
import { ViewMenu } from '~/modules/common/data-table/view-menu';
import { DropdownToggleItem } from '~/modules/common/dropdowner/dropdown-toggle-item';
import { FocusView } from '~/modules/common/focus-view';
import { isSandboxView } from '~/modules/sandbox/sandbox-account';
import { DisplayOptions } from '~/modules/task/board/display-options';
import { ProjectActionsMenu } from '~/modules/task/board/project-actions-menu';
import { ProjectHeaderToggle } from '~/modules/task/board/project-header-toggle';
import { BoardSearchBar, pageSearchScope } from '~/modules/task/board-search';
import { configureForExport } from '~/modules/task/helpers/export-helpers';
import { boardSearchQuery } from '~/modules/task/helpers/search-filter';
import { deriveTasksQueryParams, fetchTasksForExport } from '~/modules/task/query';
import type { ResolvedTasksTableProps } from '~/modules/task/table/tasks-table';
import { TaskSelectedButtons } from '~/modules/task/task-selected-buttons';
import type { BoardSearchParams, Task } from '~/modules/task/types';
import { WorkspaceActionButtons } from '~/modules/workspace/header/action-buttons';

interface TasksTableBarProps
  extends Omit<BaseTableBarProps<Task, BoardSearchParams>, 'setSearch' | 'queryKey'>,
    Omit<ResolvedTasksTableProps, 'organization' | 'tenantId'> {
  total: number | null;
  isCompact: boolean;
  setIsCompact: (isCompact: boolean) => void;
}

export function TasksTableBar({
  total,
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
  const isMobile = useBreakpointBelow('sm');
  const queryParams = publicView ? undefined : deriveTasksQueryParams(workspace, projects[0]);
  const { q, sort, order, status, type, labels, assigned } = searchVars;

  const fetchExport = async (limit: number, offset: number) => {
    if (!queryParams) return [];
    const { organizationId, tenantId, ...rest } = queryParams;
    const tableQueryParams = { ...searchVars, ...boardSearchQuery(searchVars), ...rest };
    const items = await fetchTasksForExport({ limit, offset, organizationId, tenantId, query: tableQueryParams });
    return configureForExport(items, projects);
  };

  return (
    <>
      {!publicView && (
        <TaskSelectedButtons
          selectedTaskIds={selected.map(({ id }) => id)}
          clearSelection={clearSelection}
          organizationId={queryParams?.organizationId ?? ''}
          tenantId={queryParams?.tenantId ?? ''}
        />
      )}

      <BoardSearchBar
        scope={pageSearchScope(projects, workspace?.id)}
        publicView={publicView}
        total={total}
        leading={!workspace && !publicView && projects[0] && <ProjectHeaderToggle project={projects[0]} />}
        // Only what changes the list: the search also carries the open task sheet, which must not scroll the page
        searchVars={{ q, sort, order, status, type, labels, assigned }}
        controls={
          <>
            {isMobile &&
              !publicView &&
              (workspace ? (
                // Its project list is not the table's, and a first load must not blank the table
                <Suspense>
                  <WorkspaceActionButtons />
                </Suspense>
              ) : (
                projects[0] && <ProjectActionsMenu project={projects[0]} />
              ))}
            <ViewMenu
              columns={columns}
              setColumns={setColumns}
              export={{ filename: `${appConfig.slug}-tasks`, selectedRows: configureForExport(selected, projects), fetchRows: fetchExport }}
            >
              <DropdownToggleItem checked={isCompact} onCheckedChange={setIsCompact}>
                {t('c:compact_view')}
              </DropdownToggleItem>
            </ViewMenu>

            {/* A public view has no menu to hold the toggle on a phone */}
            <DisplayOptions className={publicView ? undefined : 'max-sm:hidden'} />
            {!isSandboxView() && <FocusView iconOnly />}
          </>
        }
      />
    </>
  );
}
