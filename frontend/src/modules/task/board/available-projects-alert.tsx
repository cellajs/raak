import { useInfiniteQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { selectExistingProjects } from '~/modules/task/helpers/project-actions';
import { Button } from '~/modules/ui/button';
import { flattenInfiniteData } from '~/query/basic';

interface Props {
  workspace: Workspace;
  fallback: ReactNode;
}

/**
 * Empty-board action shown when the user can add existing organization projects
 * that are not assigned to a workspace yet.
 */
export const AvailableProjectsEmptyAction = ({ workspace, fallback }: Props) => {
  const { t } = useTranslation();

  const { data, isPending } = useInfiniteQuery(
    projectsListQueryOptions({
      organizationId: workspace.organizationId,
      excludeArchived: 'true',
      include: 'membership',
    }),
  );
  const projects = flattenInfiniteData<EnrichedProject>(data);
  const availableCount = projects.filter((project) => !project.membership?.workspaceId).length;

  if (isPending) return null;
  if (availableCount === 0) return <>{fallback}</>;

  return (
    <div className="flex max-w-lg flex-col items-center gap-3">
      <p className="text-balance text-muted-foreground text-sm">
        {t('c:unassigned_projects', { count: availableCount })}
      </p>
      <Button type="button" variant="plain" onClick={selectExistingProjects}>
        <PlusIcon size={16} />
        <span>{t('c:unassigned_projects_action')}</span>
      </Button>
    </div>
  );
};
