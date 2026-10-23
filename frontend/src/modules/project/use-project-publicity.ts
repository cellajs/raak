import { useMatch } from '@tanstack/react-router';
import type { Project } from 'sdk';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { findProjectByIdOrSlug, projectQueryKeys } from '~/modules/project/query';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';
import { queryClient } from '~/query/query-client';

/** Provides project publicity state and actions. */
export const useProjectPublicity = (projectId: string) => {
  const { tenantId } = useOrganizationLayoutContext();

  const projectMatch = useMatch({ from: '/_app/$tenantId/$organizationSlug/project/$slug', shouldThrow: false, select: () => true });
  const publicProjectMatch = useMatch({
    from: '/_public/_content/$tenantId/$organizationSlug/public/project/$slug',
    shouldThrow: false,
    select: () => true,
  });
  const workspaceMatch = useIsWorkspaceRoute();

  if (publicProjectMatch) return true;

  if (workspaceMatch || projectMatch) {
    const cached = findProjectByIdOrSlug(projectId, tenantId) ?? queryClient.getQueryData<Project>(projectQueryKeys.detail.byId(projectId));
    return cached?.public ?? false;
  }

  throw new Error('useProjectPublicity must be used within a workspace or project route.');
};
