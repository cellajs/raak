import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { useAlertStore } from '~/modules/common/alerter/alert-store';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { selectExistingProjects } from '~/modules/task/helpers/project-actions';
import { Alert, AlertDescription } from '~/modules/ui/alert';
import { Button } from '~/modules/ui/button';
import { flattenInfiniteData } from '~/query/basic';

interface Props {
  workspace: Workspace;
}

/**
 * Alert shown on a workspace board when the user has access to organization projects
 * that are not yet assigned to any of their workspaces, inviting them to add the projects here.
 */
export const AvailableProjectsAlert = ({ workspace }: Props) => {
  const { t } = useTranslation();

  const alertId = `available-projects-${workspace.id}`;
  const { alertsSeen, setAlertSeen } = useAlertStore();

  const { data, isPending } = useInfiniteQuery(
    projectsListQueryOptions({
      organizationId: workspace.organizationId,
      excludeArchived: 'true',
      include: 'membership',
    }),
  );
  const projects = flattenInfiniteData<EnrichedProject>(data);
  const availableCount = projects.filter((project) => !project.membership?.workspaceId).length;

  if (isPending || availableCount === 0 || alertsSeen.includes(alertId)) return null;

  return (
    <Alert variant="brand" soft onClose={() => setAlertSeen(alertId)} className="mb-2">
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2 pr-6">
        <span>{t('c:available_projects.text', { count: availableCount })}</span>
        <Button type="button" size="sm" onClick={selectExistingProjects}>
          {t('c:add_resource', { resource: t('c:projects').toLowerCase() })}
        </Button>
      </AlertDescription>
    </Alert>
  );
};
