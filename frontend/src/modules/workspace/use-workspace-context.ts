import { useSuspenseQuery } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { organizationQueryOptions } from '~/modules/organization/query';
import { workspaceQueryOptions } from '~/modules/workspace/query';

const workspaceApi = getRouteApi('/_app/$tenantId/$organizationSlug/workspace/$slug');

/**
 * The workspace of the current workspace route with its organization, read from the query cache by the ids in the
 * route context. The context objects get a new identity on every navigation, so nothing subscribes to them.
 */
export const useWorkspaceContext = () => {
  const workspaceId = workspaceApi.useRouteContext({ select: (c) => c.workspace.id });
  const organizationId = workspaceApi.useRouteContext({ select: (c) => c.organization.id });
  const tenantId = workspaceApi.useRouteContext({ select: (c) => c.tenantId });
  const { data: workspace } = useSuspenseQuery(workspaceQueryOptions(workspaceId, organizationId, tenantId));
  const { data: organization } = useSuspenseQuery(organizationQueryOptions(organizationId, tenantId));
  return { workspace, organization, tenantId };
};
