import { getRouteApi } from '@tanstack/react-router';

const workspaceApi = getRouteApi('/_app/$tenantId/$organizationSlug/workspace/$slug');

export const useWorkspaceContext = () => workspaceApi.useRouteContext();
