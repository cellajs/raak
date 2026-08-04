import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CircleAlertIcon, TrashIcon } from 'lucide-react';
import { useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { appConfig } from 'shared';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { ToolCard } from '~/modules/common/tool-card';
import { ToolsArrangementCard } from '~/modules/entities/tools-arrangement-card';
import type { ChannelEnrichment } from '~/modules/entities/types';
import { Button } from '~/modules/ui/button';
import { DeleteWorkspaces } from '~/modules/workspace/delete-workspaces';
import { useUpdateWorkspaceMutation, workspacesListQueryOptions } from '~/modules/workspace/query';
import { UpdateWorkspaceForm } from '~/modules/workspace/update-workspace-form';

type EnrichedWorkspace = Workspace & ChannelEnrichment;

/** General workspace form body, redirecting to the new slug after a slug-changing update. */
export function WorkspaceGeneralForm({ workspace }: { workspace: EnrichedWorkspace }) {
  const navigate = useNavigate();

  return (
    <UpdateWorkspaceForm
      workspace={workspace}
      sheet
      callback={(updatedWorkspace) => {
        if (workspace.slug !== updatedWorkspace.slug) {
          navigate({
            to: '/$tenantId/$organizationSlug/workspace/$slug',
            params: {
              tenantId: workspace.tenantId,
              slug: updatedWorkspace.slug,
              organizationSlug: updatedWorkspace.organizationId,
            },
            // The settings sheet is URL-driven by workspace id, so keeping search params
            // across the slug redirect keeps it open
            search: true,
            replace: true,
          });
        }
      }}
    />
  );
}

/** Tools arrangement card wired to the workspace update mutation. */
export function WorkspaceToolsCard({ workspace }: { workspace: EnrichedWorkspace }) {
  const { mutate } = useUpdateWorkspaceMutation();
  return (
    <ToolsArrangementCard
      entity={workspace}
      persist={(toolsConfig) =>
        mutate({
          path: { id: workspace.id, organizationId: workspace.organizationId, tenantId: workspace.tenantId },
          body: { toolsConfig },
        })
      }
    />
  );
}

/**
 * Workspace danger zone. Custom tool (not the standard `DeleteToolCard`): the notice explains
 * that projects survive deletion, and delete is blocked for the actor's only workspace.
 */
export function WorkspaceDangerCard({ workspace }: { workspace: EnrichedWorkspace }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const deleteButtonRef = useRef(null);

  const { data: workspaces = [] } = useInfiniteQuery({
    ...workspacesListQueryOptions({ organizationId: workspace.organizationId }),
    select: (data) => data.pages.flatMap((page) => page.items),
  });
  const canDelete = workspaces.length > 1;

  // Leaving the board route unmounts the URL-sheet handler, which closes the sheet
  const callback = () => navigate({ to: appConfig.defaultRedirectPath, replace: true });

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
    <ToolCard
      label="c:delete_resource"
      resource="c:workspace"
      description={
        <Trans
          i18nKey="c:delete_workspace_notice.text"
          values={{ name: workspace.name, resource: t('c:workspace').toLowerCase() }}
        />
      }
    >
      <Button
        disabled={!canDelete}
        ref={deleteButtonRef}
        variant="destructive"
        className="w-full sm:w-auto"
        onClick={openDeleteDialog}
      >
        <TrashIcon className="mr-2 size-4" />
        <span>{t('c:delete_resource', { resource: t('c:workspace').toLowerCase() })}</span>
      </Button>
      {!canDelete && (
        <p className="mt-4 flex items-center text-muted-foreground text-sm italic">
          <CircleAlertIcon strokeWidth={1.5} className="mr-1 inline" />
          {t('c:delete_workspace_restricted.text')}
        </p>
      )}
    </ToolCard>
  );
}
