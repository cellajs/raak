import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { toastOffline } from '~/modules/common/toaster/toaster';
import { useMemberUpdateMutation } from '~/modules/memberships/query-mutations';
import type { EnrichedOrganization } from '~/modules/organization/types';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { useWorkspaceArrivalStore } from '~/modules/workspace/workspace-arrival-store';
import { findMembership, getCachedMemberships } from '~/query/enrichment/helpers';
import { getRouter } from '~/routes/-router-instance';

export interface RestoreProjectProps {
  project: EnrichedProject;
  organization: EnrichedOrganization;
}

export const openProjectBoard = ({ project, organization }: RestoreProjectProps, slug: string) =>
  getRouter().navigate({
    to: '/$tenantId/$organizationSlug/workspace/$slug',
    params: { slug, organizationSlug: organization.slug, tenantId: organization.tenantId },
    search: { projectSlug: project.slug },
  });

/** Puts an archived project back on its workspace's board. With `open` it then opens that board; else it stays. */
export function useRestoreProject(props: RestoreProjectProps, { open }: { open: boolean }) {
  const { project, organization } = props;
  const queryClient = useQueryClient();
  const setArrival = useWorkspaceArrivalStore((state) => state.setArrival);
  const { mutateAsync: updateMembership } = useMemberUpdateMutation();
  const [isPending, setIsPending] = useState(false);

  const restoreProject = async () => {
    const membership = findMembership(getCachedMemberships() ?? [], project.id);
    if (!membership?.workspaceId) return;
    if (!onlineManager.isOnline()) return toastOffline();

    const path = { organizationId: organization.id, tenantId: organization.tenantId };
    setIsPending(true);
    try {
      await updateMembership({ path: { ...path, id: membership.id }, body: { archived: false }, channelId: project.id, channelType: 'project' });

      if (open) {
        // The board reads this list: fetched first, so it opens with the project's panel in it. The route retries a failure.
        const boardProjects = projectsListQueryOptions({ workspaceId: membership.workspaceId, include: 'counts', excludeArchived: 'true' });
        await queryClient.fetchInfiniteQuery({ ...boardProjects, staleTime: 0 }).catch(() => {});

        setArrival(project.id);
        openProjectBoard(props, membership.workspaceId);
      }
    } catch {
      // The global error handler has toasted it: this stays on the project page
    }
    setIsPending(false);
    dropdowner.getState().remove();
  };

  return { restoreProject, isPending };
}
