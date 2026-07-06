import { createFileRoute } from '@tanstack/react-router';
import { PublicProjectRouteComponent } from '~/modules/project/public-route-components';
import { publicProjectRouteBeforeLoad } from '~/modules/project/public-route-logic';
import { focusTask } from '~/modules/task/helpers/focus-task';
import { combinedTaskSearchSchema } from '~/modules/task/search-params-schemas';
import { createErrorComponent } from '~/routes/route-utils';
import { appTitle } from '~/utils/app-title';

/**
 * Layout route for public project pages.
 * Captures $slug param, validates project access,
 * fetches the project, and provides context for all nested routes.
 */
export const Route = createFileRoute('/_public/_content/$tenantId/$organizationSlug/public/project/$slug')({
  staticData: { isAuth: false },
  validateSearch: combinedTaskSearchSchema,
  onLeave: () => focusTask(null),
  beforeLoad: publicProjectRouteBeforeLoad,
  head: ({ match }) => {
    const { project } = match.context;
    const view = match.search.view === 'table' ? 'Table' : 'Board';
    return { meta: [{ title: appTitle(`${view} · Public view of ${project?.name || 'project'}`) }] };
  },
  errorComponent: createErrorComponent('public'),
  component: PublicProjectRouteComponent,
});
