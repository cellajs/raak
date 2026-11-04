import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useInfiniteRows } from '~/modules/common/data-table/use-infinite-rows';
import { DropdownActionItem, DropdownActionSeparator } from '~/modules/common/dropdowner/dropdown-action-item';
import { myMembershipsQueryOptions } from '~/modules/me/query';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { openProjectBoard, type RestoreProjectProps, useRestoreProject } from '~/modules/workspace/use-restore-project';
import { findMembership } from '~/query/enrichment/helpers';

/** The project menu's way to its workspace, with a separator after it; a press first restores an archived project. */
export function OpenInWorkspaceItem(props: RestoreProjectProps) {
  const { project, organization } = props;
  const { t } = useTranslation();
  const { restoreProject, isPending } = useRestoreProject(props, { open: true });
  const { rows: workspaces } = useInfiniteRows({ ...workspacesListQueryOptions({ organizationId: organization.id }), refetchOnMount: false });

  const { data: myMemberships } = useQuery(myMembershipsQueryOptions());

  const membership = findMembership(myMemberships?.items ?? [], project.id);
  if (!membership?.workspaceId) return null;
  const { archived, workspaceId } = membership;
  const current = workspaces?.find(({ id }) => id === workspaceId);

  return (
    <>
      {archived ? (
        <DropdownActionItem icon={ArrowRightIcon} closeOnSelect={false} loading={isPending} onSelect={restoreProject}>
          <span className="text-left">
            {t('c:open_in_workspace')}
            <span className="text-muted-foreground block text-xs font-normal">{t('c:open_in_workspace_restores.text')}</span>
          </span>
        </DropdownActionItem>
      ) : (
        <DropdownActionItem icon={ArrowRightIcon} onSelect={() => openProjectBoard(props, current?.slug ?? workspaceId)}>
          <span>{t('c:open_in_workspace')}</span>
          {current && <span className="text-muted-foreground ml-auto max-w-32 truncate pl-3 text-xs font-normal">{current.name}</span>}
        </DropdownActionItem>
      )}
      <DropdownActionSeparator />
    </>
  );
}
