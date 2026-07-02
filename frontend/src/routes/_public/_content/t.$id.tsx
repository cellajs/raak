import { createFileRoute, redirect } from '@tanstack/react-router';
import i18n from 'i18next';
import { resolveTaskLink } from 'sdk';
import { appConfig } from 'shared';
import { ApiError } from '~/lib/api';
import { useToastStore } from '~/modules/common/toaster/toast-store';
import { useUserStore } from '~/modules/user/user-store';
import { findWorkspaceByIdOrSlug } from '~/modules/workspace/query';
import { getCachedMemberships } from '~/query/enrichment/helpers';
import { cacheRestored } from '~/query/query-client';
import { SpinnerPage } from '~/routes/route-utils';

// Local wrapper so autoCodeSplitting keeps the spinner available to both the (split)
// component and the (non-split) pendingComponent. The splitter only hoists shared local
// bindings — not shared imports — into a shared chunk, so referencing the SpinnerPage
// import directly from both props strips it from the main chunk (ReferenceError).
const TaskLinkSpinner = () => <SpinnerPage />;

/**
 * Task link resolver route.
 * TODO: review
 *
 * When a user visits /t/:id (redirected from the backend OG/redirect handler),
 * this route resolves the task's context and decides where to send them:
 *
 * - Authenticated + has org access → private project board with task sheet
 * - Authenticated + no access + public project → public board with task sheet
 * - Authenticated + no access + private project → error (no access)
 * - Not authenticated + public project → public board with task sheet
 * - Not authenticated + private project → sign-in page with redirect back
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
        useToastStore.getState().showToast(i18n.t('error:not_found.text'), 'warning');
      }
      throw err;
    }

    const { taskId, projectId, projectSlug, organizationId, organizationSlug, tenantId, publicAt } = resolved;

    // Check if user is authenticated (set by PublicLayoutRoute.beforeLoad, inherited via PublicContentLayoutRoute)
    const user = useUserStore.getState().user;

    if (user) {
      // Wait for IDB cache restoration so memberships are available
      await cacheRestored;

      const memberships = getCachedMemberships();
      const hasOrgAccess = memberships?.some((m) => m.organizationId === organizationId);

      if (hasOrgAccess) {
        const projectMembership = memberships?.find((m) => m.projectId === projectId && m.workspaceId);
        const workspace = projectMembership?.workspaceId
          ? findWorkspaceByIdOrSlug(projectMembership.workspaceId, tenantId)
          : undefined;

        if (workspace) {
          // Redirect to workspace board filtered to this project, with task sheet open
          throw redirect({
            to: '/$tenantId/$organizationSlug/workspace/$slug',
            params: { tenantId, organizationSlug: organizationSlug, slug: workspace.slug },
            search: { projectSlug, taskSheetId: taskId },
            replace: true,
          });
        }

        // No workspace cached — redirect to project board directly
        throw redirect({
          to: '/$tenantId/$organizationSlug/project/$slug',
          params: { tenantId, organizationSlug: organizationSlug, slug: projectSlug },
          search: { taskSheetId: taskId },
          replace: true,
        });
      }

      // No org access but project is public — show public view
      if (publicAt) {
        throw redirect({
          to: '/$tenantId/$organizationSlug/public/project/$slug',
          params: { tenantId, organizationSlug, slug: projectSlug },
          search: { taskSheetId: taskId },
          replace: true,
        });
      }

      // No org access and not public — show error
      useToastStore.getState().showToast(i18n.t('error:forbidden.text'), 'warning');
      throw redirect({ to: appConfig.defaultRedirectPath, replace: true });
    }

    // Not authenticated
    if (publicAt) {
      // Public project — redirect to public board
      throw redirect({
        to: '/$tenantId/$organizationSlug/public/project/$slug',
        params: { tenantId, organizationSlug, slug: projectSlug },
        search: { taskSheetId: taskId },
        replace: true,
      });
    }

    // Not authenticated + private project — redirect to sign-in with return URL
    throw redirect({
      to: '/auth/authenticate',
      search: { fromRoot: true, redirect: `/t/${id}` },
      replace: true,
    });
  },
  // This component should never render because beforeLoad always throws a redirect,
  // but we need it for the route to be valid
  component: TaskLinkSpinner,
});
