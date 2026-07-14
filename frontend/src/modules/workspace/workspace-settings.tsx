import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CircleAlertIcon, Trash2Icon } from 'lucide-react';
import { useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { appConfig } from 'shared';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { Button } from '~/modules/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/modules/ui/card';
import { DeleteWorkspaces } from '~/modules/workspace/delete-workspaces';
import { UpdateWorkspaceForm } from '~/modules/workspace/update-workspace-form';
import { workspacesListQueryOptions } from './query';

export const WorkspaceSettings = ({ workspace, sheet: isSheet }: { workspace: Workspace; sheet?: boolean }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const deleteButtonRef = useRef(null);

  // Check if workspace can be deleted
  const { data: workspaces = [] } = useInfiniteQuery({
    ...workspacesListQueryOptions({ organizationId: workspace.organizationId }),
    select: (data) => data.pages.flatMap((p) => p.items),
  });
  const canDelete = workspaces.length > 1;

  const callback = () => {
    if (isSheet) useSheeter.getState().remove('update-workspace');
    navigate({ to: appConfig.defaultRedirectPath, replace: true });
  };

  const openDeleteDialog = () => {
    useDialoger.getState().create(<DeleteWorkspaces dialog workspaces={[workspace]} callback={callback} />, {
      id: 'delete-workspace',
      triggerRef: deleteButtonRef,
      className: 'md:max-w-xl',
      title: t('c:delete_resource', { resource: t('c:workspace').toLowerCase() }),
      description: t('c:confirm.delete_resource', {
        name: workspace.name,
        resource: t('c:workspace').toLowerCase(),
      }),
    });
  };

  return (
    <div className="mb-12 flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('c:general')}</CardTitle>
        </CardHeader>
        <CardContent>
          <UpdateWorkspaceForm
            workspace={workspace}
            callback={(updatedWorkspace) => {
              if (workspace.slug !== updatedWorkspace.slug) {
                navigate({
                  to: '/$tenantId/$organizationSlug/workspace/$slug',
                  params: {
                    tenantId: workspace.tenantId,
                    slug: updatedWorkspace.slug,
                    organizationSlug: updatedWorkspace.organizationId,
                  },
                  replace: true,
                });
              }
            }}
            sheet={isSheet}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('c:delete_resource', { resource: t('c:workspace').toLowerCase() })}</CardTitle>
          <CardDescription>
            <Trans
              i18nKey={'c:delete_workspace_notice.text'}
              values={{ name: workspace.name, resource: t('c:workspace').toLowerCase() }}
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            disabled={!canDelete}
            ref={deleteButtonRef}
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={openDeleteDialog}
          >
            <Trash2Icon className="mr-2 h-4 w-4" />
            <span>{t('c:delete_resource', { resource: t('c:workspace').toLowerCase() })}</span>
          </Button>
          {!canDelete && (
            <p className="mt-4 flex items-center text-muted-foreground text-sm italic">
              <CircleAlertIcon strokeWidth={1.5} className="mr-1 inline" />
              {t('c:delete_workspace_restricted.text')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
