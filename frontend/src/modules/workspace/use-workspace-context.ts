import { getRouteApi } from '@tanstack/react-router';

const workspaceApi = getRouteApi('/_app/$tenantId/$organizationSlug/workspace/$slug');

/** Provides workspace context state and actions. */
export const useWorkspaceContext = () => workspaceApi.useRouteContext();
