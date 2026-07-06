import { createFileRoute } from '@tanstack/react-router';
import { ProjectRouteComponent } from '~/modules/project/route-components';
import { projectRouteBeforeLoad } from '~/modules/project/route-logic';
import { resetTaskInteraction } from '~/modules/task/helpers/board-helpers';
import { combinedTaskSearchSchema } from '~/modules/task/search-params-schemas';
import { createErrorComponent } from '~/routes/route-utils';
import { appTitle } from '~/utils/app-title';

/**
 * Main project page with details and navigation.
 */
export const Route = createFileRoute('/_app/$tenantId/$organizationSlug/project/$slug')({
  staticData: {
    isAuth: true,
    floatingNavButtons: { left: 'menu' },
  },
  validateSearch: combinedTaskSearchSchema,
  onLeave: resetTaskInteraction,
  beforeLoad: projectRouteBeforeLoad,
  head: ({ match }) => {
    const name = match.context.project?.name;
    const view = match.search.view === 'table' ? 'Table' : 'Board';
    return { meta: [{ title: appTitle(`${view} · ${name}`) }] };
  },
  errorComponent: createErrorComponent('app'),
  component: ProjectRouteComponent,
});
