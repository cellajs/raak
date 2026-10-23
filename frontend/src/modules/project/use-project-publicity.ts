import { useMatch } from '@tanstack/react-router';
import type { Project } from 'sdk';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { findProjectByIdOrSlug, projectQueryKeys } from '~/modules/project/query';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';
import { queryClient } from '~/query/query-client';

/** Whether the project is public: always on the public route, else read from the cache. */
export const useProjectPublicity = (projectId: string) => {
  const { tenantId } = useOrganizationLayoutContext();

  const isProjectRoute = useMatch({ from: '/_app/$tenantId/$organizationSlug/project/$slug', shouldThrow: false, select: () => true });
  const isPublicProjectRoute = useMatch({
    from: '/_public/_content/$tenantId/$organizationSlug/public/project/$slug',
    shouldThrow: false,
    select: () => true,
  });
  const isWorkspaceRoute = useIsWorkspaceRoute();

  if (isPublicProjectRoute) return true;

  if (isWorkspaceRoute || isProjectRoute) {
    const cached = findProjectByIdOrSlug(projectId, tenantId) ?? queryClient.getQueryData<Project>(projectQueryKeys.detail.byId(projectId));
    return cached?.public ?? false;
  }

  throw new Error('useProjectPublicity must be used within a workspace or project route.');
};
