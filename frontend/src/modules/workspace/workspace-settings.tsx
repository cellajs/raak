import { useNavigate } from '@tanstack/react-router';
import i18n from 'i18next';
import type { RefObject } from 'react';
import type { Workspace } from 'sdk';
import { appConfig } from 'shared';
import type { CallbackArgs } from '~/modules/common/data-table/types';
import { NamedText } from '~/modules/common/named-text';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { ToolCard } from '~/modules/common/tool-card';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { DeleteToolCard } from '~/modules/entities/channel-settings-tools';
import { DeleteWorkspaces } from '~/modules/workspace/delete-workspaces';
import { useOrganizationWorkspaces } from '~/modules/workspace/query';
import { UpdateWorkspaceForm } from '~/modules/workspace/update-workspace-form';

export function openWorkspaceSettingsSheet(workspace: Workspace, triggerRef: RefObject<HTMLButtonElement | null>) {
  sheeter.getState().create(
    <div className="container">
      <WorkspaceSettings workspace={workspace} />
    </div>,
    {
      id: 'update-workspace',
      triggerRef,
      side: 'right',
      className: 'max-w-full lg:max-w-4xl',
      title: i18n.t('c:resource_settings', { resource: i18n.t('c:workspace') }),
      titleContent: <UnsavedBadge title={i18n.t('c:resource_settings', { resource: i18n.t('c:workspace') })} />,
      description: <NamedText i18nKey="c:workspace_settings.text" name={workspace.name} />,
    },
  );
}

interface WorkspaceSettingsProps {
  workspace: Workspace;
}

function WorkspaceSettings({ workspace }: WorkspaceSettingsProps) {
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
    <div className="mb-12 flex flex-col gap-8">
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
      <DeleteToolCard
        name={workspace.name}
        resource="c:workspace"
        dialogId="delete-workspace"
        notice="c:delete_workspace_notice.text"
        disabledReason={canDelete ? undefined : 'c:delete_workspace_restricted.text'}
        renderDialog={() => <DeleteWorkspaces workspaces={[workspace]} callback={handleDeleted} />}
      />
    </div>
  );
}
