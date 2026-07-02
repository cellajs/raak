import i18n from 'i18next';
import type { Organization } from 'sdk';
import { ApiError } from '~/lib/api';
import { useToastStore } from '~/modules/common/toaster/toast-store';
import { publicProjectQueryOptions } from '~/modules/project/query';
import { queryClient } from '~/query/query-client';

type PublicProjectRouteBeforeLoadArgs = {
  params: { slug: string; tenantId: string; organizationSlug: string };
};

/**
 * beforeLoad logic for the public project route.
 * Validates project access, fetches the project, and provides a minimal organization
 * context so shared components can access tenantId and organizationId without the
 * authenticated organization layout.
 */
export const publicProjectRouteBeforeLoad = async ({ params }: PublicProjectRouteBeforeLoadArgs) => {
  const { slug, tenantId, organizationSlug } = params;
  try {
    const project = await queryClient.ensureQueryData(publicProjectQueryOptions(slug, true));

    // Provide a minimal organization context so shared components
    // (board, table, cards) can access tenantId and organizationId
    // without requiring the authenticated OrganizationLayoutRoute.
    const organization = {
      id: project.organizationId,
      slug: organizationSlug,
      tenantId,
      entityType: 'organization' as const,
    } as Organization;

    return { project, tenantId, organization };
  } catch (err) {
    // Show a toast and bubble up the error to the error boundary
    if (err instanceof ApiError) {
      useToastStore.getState().showToast(i18n.t('c:project_not_public.text'), 'info');
    }
    throw err;
  }
};
