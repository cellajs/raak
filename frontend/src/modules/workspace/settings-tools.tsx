import { useNavigate } from '@tanstack/react-router';
import type { Workspace } from 'sdk';
import { appConfig } from 'shared';
import type { CallbackArgs } from '~/modules/common/data-table/types';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { ToolCard } from '~/modules/common/tool-card';
import { DeleteToolCard } from '~/modules/entities/channel-settings-tools';
import { DeleteWorkspaces } from '~/modules/workspace/delete-workspaces';
import { useOrganizationWorkspaces } from '~/modules/workspace/query';
import { UpdateWorkspaceForm } from '~/modules/workspace/update-workspace-form';

interface WorkspaceCardProps {
  workspace: Workspace;
}

export function WorkspaceGeneralCard({ workspace }: WorkspaceCardProps) {
  const navigate = useNavigate();

  return (
    <ToolCard label="c:general">
      <UpdateWorkspaceForm
        workspace={workspace}
        callback={(updatedWorkspace) => {
          if (workspace.slug !== updatedWorkspace.slug) {
            navigate({
              from: '/$tenantId/$organizationSlug/workspace/$slug',
              to: '/$tenantId/$organizationSlug/workspace/$slug',
              params: (prev) => ({ ...prev, slug: updatedWorkspace.slug }),
              replace: true,
            });
          }
        }}
      />
    </ToolCard>
  );
}

export function WorkspaceDeleteCard({ workspace }: WorkspaceCardProps) {
  const navigate = useNavigate();

  // The last workspace of an organization cannot be deleted.
  const workspaces = useOrganizationWorkspaces(workspace.organizationId);
  const canDelete = workspaces.length > 1;

  const handleDeleted = (args: CallbackArgs<Workspace[]>) => {
    if (args.status !== 'success') return;
    sheeter.getState().remove('update-workspace');
    navigate({ to: appConfig.defaultRedirectPath, replace: true });
  };

  return (
    <DeleteToolCard
      name={workspace.name}
      resource="c:workspace"
      dialogId="delete-workspace"
      notice="c:delete_workspace_notice.text"
      disabledReason={canDelete ? undefined : 'c:delete_workspace_restricted.text'}
      renderDialog={() => <DeleteWorkspaces workspaces={[workspace]} callback={handleDeleted} />}
    />
  );
}
