import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { InfoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { AlertBanner } from '~/modules/common/alerter/alert-banner';
import { useInfiniteRows } from '~/modules/common/data-table/use-infinite-rows';
import { myMembershipsQueryOptions } from '~/modules/me/query';
import { organizationQueryOptions } from '~/modules/organization/query';
import type { EnrichedProject } from '~/modules/project/types';
import { Button } from '~/modules/ui/button';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { useRestoreProject } from '~/modules/workspace/use-restore-project';
import { findMembership } from '~/query/enrichment/helpers';

/** Below a project page's search bar while the project is archived. Closing it is remembered per project. */
export function ProjectArchivedBanner({ project }: { project: EnrichedProject }) {
  const { t } = useTranslation();
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const { data: organization } = useSuspenseQuery(organizationQueryOptions(organizationId, tenantId));
  const { restoreProject, isPending } = useRestoreProject({ project, organization }, { open: false });
  const { rows: workspaces } = useInfiniteRows({ ...workspacesListQueryOptions({ organizationId }), refetchOnMount: false });

  const { data: myMemberships } = useQuery(myMembershipsQueryOptions());

  const membership = findMembership(myMemberships?.items ?? [], project.id);
  if (!membership?.archived || !membership.workspaceId || !workspaces) return null;

  const name = workspaces.find(({ id }) => id === membership.workspaceId)?.name ?? t('c:workspace');

  return (
    <AlertBanner
      id={`project_filing_${project.id}`}
      variant="info"
      icon={InfoIcon}
      animate
      // One row from `sm` up: the action's default two would leave the single line of text at the top
      className="sm:items-center sm:py-2 sm:[&>[data-slot=alert-action]]:row-span-1 sm:[&>svg]:translate-y-0"
      action={
        <Button variant="secondary" size="sm" loading={isPending} className="max-sm:h-10" onClick={restoreProject}>
          {t('c:restore')}
        </Button>
      }
    >
      {t('c:project_archived_filed.text', { name })}
    </AlertBanner>
  );
}
