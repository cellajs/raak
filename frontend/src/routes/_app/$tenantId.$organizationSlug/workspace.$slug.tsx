import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { resetTaskInteraction } from '~/modules/task/helpers/board-helpers';
import { combinedTaskSearchSchema, tasksSearchDefaults } from '~/modules/task/search-params-schemas';
import { WorkspaceRouteComponent } from '~/modules/workspace/route-components';
import { workspaceRouteBeforeLoad } from '~/modules/workspace/route-logic';
import { createErrorComponent } from '~/routes/_route-utils';
import { appTitle } from '~/utils/app-title';

/**
 * Main workspace page with details and navigation.
 */
export const Route = createFileRoute('/_app/$tenantId/$organizationSlug/workspace/$slug')({
  validateSearch: combinedTaskSearchSchema,
  // Absence means default: params equal to the default view are stripped from the URL
  search: { middlewares: [stripSearchParams(tasksSearchDefaults)] },
  staticData: {
    isAuth: true,
    floatingNavButtons: { left: 'menu' },
  },
  onLeave: resetTaskInteraction,
  beforeLoad: workspaceRouteBeforeLoad,
  head: ({ match }) => {
    const name = match.context.workspace?.name;
    const view = match.search.view === 'table' ? 'Table' : 'Board';
    return { meta: [{ title: appTitle(`${view} · ${name}`) }] };
  },
  errorComponent: createErrorComponent('app'),
  component: WorkspaceRouteComponent,
});
