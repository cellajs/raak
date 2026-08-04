import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useUrlSheet } from '~/modules/common/sheeter/use-url-sheet';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { ChannelSettingsSheet } from '~/modules/entities/channel-settings-sheet';
import { findProjectByIdOrSlug, projectQueryOptions } from '~/modules/project/query';

function ProjectSettingsSheetContent({ id, organizationId }: { id: string; organizationId?: string }) {
  const { tenantId } = useOrganizationLayoutContext();
  const { data: project } = useQuery({
    ...projectQueryOptions(id, organizationId ?? '', tenantId),
    enabled: !!organizationId,
  });

  if (!project) return null;

  return (
    <div className="container w-full">
      <ChannelSettingsSheet entity={project} />
    </div>
  );
}

/**
 * Handles opening/closing the project settings sheet based on URL search params.
 * Listens to `projectSettingsId` in search params and manages the sheet lifecycle.
 */
export function ProjectSettingsSheetHandler() {
  const { t } = useTranslation();
  const { tenantId } = useOrganizationLayoutContext();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const projectName = search.projectSettingsId
    ? findProjectByIdOrSlug(search.projectSettingsId, tenantId)?.name
    : undefined;

  const title = t('c:resource_settings', { resource: t('c:project') });

  useUrlSheet({
    searchParamKey: 'projectSettingsId',
    renderContent: (id, organizationId) => <ProjectSettingsSheetContent id={id} organizationId={organizationId} />,
    options: {
      side: 'right',
      className: 'max-w-full lg:max-w-4xl',
      title,
      titleContent: <UnsavedBadge title={title} />,
      description: t('c:project_settings.text', { name: projectName ?? '' }),
    },
  });

  return null;
}
