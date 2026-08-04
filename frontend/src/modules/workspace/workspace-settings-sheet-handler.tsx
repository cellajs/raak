import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useUrlSheet } from '~/modules/common/sheeter/use-url-sheet';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { ChannelSettingsSheet } from '~/modules/entities/channel-settings-sheet';
import { findWorkspaceByIdOrSlug, workspaceQueryOptions } from '~/modules/workspace/query';

function WorkspaceSettingsSheetContent({ id, organizationId }: { id: string; organizationId?: string }) {
  const { tenantId } = useOrganizationLayoutContext();
  const { data: workspace } = useQuery({
    ...workspaceQueryOptions(id, organizationId ?? '', tenantId),
    enabled: !!organizationId,
  });

  if (!workspace) return null;

  return (
    <div className="container w-full">
      <ChannelSettingsSheet entity={workspace} />
    </div>
  );
}

/**
 * Handles opening/closing the workspace settings sheet based on URL search params.
 * Listens to `workspaceSettingsId` in search params and manages the sheet lifecycle.
 */
export function WorkspaceSettingsSheetHandler() {
  const { t } = useTranslation();
  const { tenantId } = useOrganizationLayoutContext();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const workspaceName = search.workspaceSettingsId
    ? findWorkspaceByIdOrSlug(search.workspaceSettingsId, tenantId)?.name
    : undefined;

  const title = t('c:resource_settings', { resource: t('c:workspace') });

  useUrlSheet({
    searchParamKey: 'workspaceSettingsId',
    renderContent: (id, organizationId) => <WorkspaceSettingsSheetContent id={id} organizationId={organizationId} />,
    options: {
      side: 'right',
      className: 'max-w-full lg:max-w-4xl',
      title,
      titleContent: <UnsavedBadge title={title} />,
      description: t('c:workspace_settings.text', { name: workspaceName ?? '' }),
    },
  });

  return null;
}
