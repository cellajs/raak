import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi, useMatch } from '@tanstack/react-router';
import { organizationQueryOptions } from '~/modules/organization/query';
import { workspaceQueryOptions } from '~/modules/workspace/query';

const workspaceRouteId = '/_app/$tenantId/$organizationSlug/workspace/$slug';

/** Strict reads of the workspace route, for components that only render under it. */
export const workspaceRouteApi = getRouteApi(workspaceRouteId);

/** Whether the workspace route is active, for components that also render on project pages or in sheets. */
export const useIsWorkspaceRoute = () => useMatch({ from: workspaceRouteId, shouldThrow: false, select: () => true }) ?? false;

/**
 * The workspace of the current workspace route with its organization, read from the query cache by the ids in the
 * route context. The context objects get a new identity on every navigation, so nothing subscribes to them.
 */
export const useWorkspaceContext = () => {
  const workspaceId = workspaceRouteApi.useRouteContext({ select: (context) => context.workspace.id });
  const organizationId = workspaceRouteApi.useRouteContext({ select: (context) => context.organization.id });
  const tenantId = workspaceRouteApi.useRouteContext({ select: (context) => context.tenantId });
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId, organizationId, tenantId));
  const { data: organization } = useSuspenseQuery(organizationQueryOptions(organizationId, tenantId));
  return { workspace, organization, tenantId };
};
