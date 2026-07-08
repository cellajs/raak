import { useMatchRoute } from '@tanstack/react-router';
import type { Project } from 'sdk';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { findProjectByIdOrSlug, projectQueryKeys } from '~/modules/project/query';
import { queryClient } from '~/query/query-client';

export const useProjectPublicity = (projectId: string) => {
  const matchRoute = useMatchRoute();
  const { tenantId } = useOrganizationLayoutContext();

  const projectMatch = matchRoute({ to: '/$tenantId/$organizationSlug/project/$slug', fuzzy: true });
  const publicProjectMatch = matchRoute({ to: '/$tenantId/$organizationSlug/public/project/$slug', fuzzy: true });
  const workspaceMatch = matchRoute({ to: '/$tenantId/$organizationSlug/workspace/$slug', fuzzy: true });

  if (publicProjectMatch) return true;

  if (workspaceMatch || projectMatch) {
    const cached =
      findProjectByIdOrSlug(projectId, tenantId) ??
      queryClient.getQueryData<Project>(projectQueryKeys.detail.byId(projectId));
    return cached?.publicAt !== null && cached?.publicAt !== undefined;
  }

  throw new Error('useProjectPublicity must be used within a workspace or project route.');
};
