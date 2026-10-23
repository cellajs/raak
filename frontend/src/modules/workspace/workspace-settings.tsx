import { useNavigate } from '@tanstack/react-router';
import i18n from 'i18next';
import { CircleAlertIcon, Trash2Icon } from 'lucide-react';
import { type RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { appConfig } from 'shared';
import type { CallbackArgs } from '~/modules/common/data-table/types';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { NamedText } from '~/modules/common/named-text';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { Button } from '~/modules/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/modules/ui/card';
import { DeleteWorkspaces } from '~/modules/workspace/delete-workspaces';
import { useOrganizationWorkspaces } from '~/modules/workspace/query';
import { UpdateWorkspaceForm } from '~/modules/workspace/update-workspace-form';

export function openWorkspaceSettingsSheet(workspace: Workspace, triggerRef: RefObject<HTMLButtonElement | null>) {
  sheeter.getState().create(
    <div className="container w-full">
      <WorkspaceSettings workspace={workspace} />
    </div>,
    {
      id: 'update-workspace',
      triggerRef,
      side: 'right',
      className: 'max-w-full lg:max-w-4xl',
      title: i18n.t('c:resource_settings', { resource: i18n.t('c:workspace') }),
      titleContent: <UnsavedBadge title={i18n.t('c:resource_settings', { resource: i18n.t('c:workspace') })} />,
      description: i18n.t('c:workspace_settings.text', { name: workspace.name }),
    },
  );
}

interface WorkspaceSettingsProps {
  workspace: Workspace;
}

function WorkspaceSettings({ workspace }: WorkspaceSettingsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const deleteButtonRef = useRef(null);

  // Check if workspace can be deleted
  const workspaces = useOrganizationWorkspaces(workspace.organizationId);
  const canDelete = workspaces.length > 1;

  const handleDeleted = (args: CallbackArgs<Workspace[]>) => {
    if (args.status !== 'success') return;
    sheeter.getState().remove('update-workspace');
    navigate({ to: appConfig.defaultRedirectPath, replace: true });
  };

  const openDeleteDialog = () => {
    dialoger.getState().create(<DeleteWorkspaces dialog workspaces={[workspace]} callback={handleDeleted} />, {
      id: 'delete-workspace',
      triggerRef: deleteButtonRef,
      className: 'md:max-w-xl',
      title: t('c:delete_resource', { resource: t('c:workspace').toLowerCase() }),
      description: <NamedText i18nKey="c:confirm.delete_resource" name={workspace.name} values={{ resource: t('c:workspace').toLowerCase() }} />,
    });
  };

  return (
    <div className="mb-12 flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle level={2}>{t('c:general')}</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle level={2}>{t('c:delete_resource', { resource: t('c:workspace').toLowerCase() })}</CardTitle>
          <CardDescription>{t('c:delete_workspace_notice.text')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled={!canDelete} ref={deleteButtonRef} variant="destructive" className="w-full sm:w-auto" onClick={openDeleteDialog}>
            <Trash2Icon />
            <span>{t('c:delete_resource', { resource: t('c:workspace').toLowerCase() })}</span>
          </Button>
          {!canDelete && (
            <p className="mt-4 flex items-center gap-1 text-muted-foreground text-sm italic">
              <CircleAlertIcon />
              {t('c:delete_workspace_restricted.text')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
