import { ArrowRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInfiniteRows } from '~/modules/common/data-table/use-infinite-rows';
import { DropdownActionItem, DropdownActionSeparator } from '~/modules/common/dropdowner/dropdown-action-item';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { openProjectBoard, type RestoreProjectProps, useRestoreProject } from '~/modules/workspace/use-restore-project';

/** The project menu's way to its workspace, with a separator after it; a press first restores an archived project. */
export function OpenInWorkspaceItem(props: RestoreProjectProps) {
  const { project, organization } = props;
  const { t } = useTranslation();
  const { restoreProject, isPending } = useRestoreProject(props, { open: true });
  const { rows: workspaces } = useInfiniteRows({ ...workspacesListQueryOptions({ organizationId: organization.id }), refetchOnMount: false });

  const membership = project.membership;
  if (!membership?.workspaceId) return null;
  const { archived, workspaceId } = membership;
  const current = workspaces?.find(({ id }) => id === workspaceId);

  return (
    <>
      {archived ? (
        <DropdownActionItem icon={ArrowRightIcon} closeOnSelect={false} loading={isPending} onSelect={restoreProject}>
          <span className="text-left">
            {t('c:open_in_workspace')}
            <span className="block font-normal text-muted-foreground text-xs">{t('c:open_in_workspace_restores.text')}</span>
          </span>
        </DropdownActionItem>
      ) : (
        <DropdownActionItem icon={ArrowRightIcon} onSelect={() => openProjectBoard(props, current?.slug ?? workspaceId)}>
          <span>{t('c:open_in_workspace')}</span>
          {current && <span className="ml-auto max-w-32 truncate pl-3 font-normal text-muted-foreground text-xs">{current.name}</span>}
        </DropdownActionItem>
      )}
      <DropdownActionSeparator />
    </>
  );
}
