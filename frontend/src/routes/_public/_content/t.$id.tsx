import { createFileRoute, redirect } from '@tanstack/react-router';
import i18n from 'i18next';
import { resolveTaskLink } from 'sdk';
import { appConfig } from 'shared';
import { ApiError } from '~/lib/api';
import { toaster } from '~/modules/common/toaster/toaster';
import { getMenuData } from '~/modules/navigation/menu-sheet/helpers/get-menu-data';
import { useUserStore } from '~/modules/user/user-store';
import { getCachedMemberships } from '~/query/enrichment/helpers';
import { cacheRestored } from '~/query/query-client';
import { SpinnerPage } from '~/routes/-route-utils';
import { getProductRoute } from '~/utils/channel-route';

// Local wrapper so autoCodeSplitting keeps the spinner available to both the (split)
// component and the (non-split) pendingComponent. The splitter only hoists shared local
// bindings, not shared imports, into a shared chunk, so referencing the SpinnerPage
// import directly from both props strips it from the main chunk (ReferenceError).
function TaskLinkSpinner() {
  return <SpinnerPage />;
}

/**
 * Task link resolver route.
 *
 * When a user visits /t/:id (redirected from the backend OG/redirect handler),
 * this route resolves the task's context and decides where to send them:
 *
 * - Authenticated + has org access -> the project's page as the menu reaches it (its workspace board when the viewer
 *   lists it under one, else the project board), task sheet open
 * - Authenticated + no access + public project -> public board with task sheet
 * - Authenticated + no access + private project -> error (no access)
 * - Not authenticated + public project -> public board with task sheet
 * - Not authenticated + private project -> sign-in page with redirect back
 */
export const Route = createFileRoute('/_public/_content/t/$id')({
  staticData: { isAuth: false },
  pendingComponent: TaskLinkSpinner,
  beforeLoad: async ({ params: { id } }) => {
    // Resolve the task link metadata from the backend
    let resolved: Awaited<ReturnType<typeof resolveTaskLink>>;
    try {
      resolved = await resolveTaskLink({ path: { id } });
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        toaster.warning(i18n.t('error:not_found.text'));
      }
      throw err;
    }

    const { taskId, projectId, projectSlug, organizationId, organizationSlug, tenantId, publicAt } = resolved;

    // Check if user is authenticated (set by PublicLayoutRoute.beforeLoad, inherited via PublicContentLayoutRoute)
    const user = useUserStore.getState().user;

    if (user) {
      // The memberships and channel lists decide the page: the restored cache has them, a fresh device loads them here.
      await cacheRestored;
      await getMenuData();

      const memberships = getCachedMemberships();
      const hasOrgAccess = memberships?.some((m) => m.organizationId === organizationId);

      if (hasOrgAccess) {
        const route = getProductRoute({
          tenantId,
          organizationId,
          channelType: 'project',
          channelId: projectId,
          entityType: 'task',
          subjectId: taskId,
        });
        if (route) throw redirect({ to: route.to, params: route.params, search: route.search, replace: true });
      }

      // No org access but project is public, show public view.
      if (publicAt) {
        throw redirect({
          to: '/$tenantId/$organizationSlug/public/project/$slug',
          params: { tenantId, organizationSlug, slug: projectSlug },
          search: { taskSheetId: taskId },
          replace: true,
        });
      }

      // No org access and not public, show error.
      toaster.warning(i18n.t('error:forbidden.text'));
      throw redirect({ to: appConfig.defaultRedirectPath, replace: true });
    }

    // Not authenticated
    if (publicAt) {
      // Public project, redirect to public board.
      throw redirect({
        to: '/$tenantId/$organizationSlug/public/project/$slug',
        params: { tenantId, organizationSlug, slug: projectSlug },
        search: { taskSheetId: taskId },
        replace: true,
      });
    }

    // Not authenticated + private project, redirect to sign-in with return URL.
    throw redirect({ to: '/auth/authenticate', search: { fromRoot: true, redirect: `/t/${id}` }, replace: true });
  },
  // This component should never render because beforeLoad always throws a redirect,
  // but we need it for the route to be valid
  component: TaskLinkSpinner,
});
