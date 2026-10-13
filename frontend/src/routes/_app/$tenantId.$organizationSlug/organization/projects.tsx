import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { OrganizationProjectsComponent } from '~/modules/project/route-components';
import { projectsRouteSearchParamsSchema, projectsSearchDefaults } from '~/modules/project/search-params-schemas';
import { appTitle } from '~/utils/app-title';

export const Route = createFileRoute('/_app/$tenantId/$organizationSlug/organization/projects')({
  validateSearch: projectsRouteSearchParamsSchema,
  search: { middlewares: [stripSearchParams(projectsSearchDefaults)] },
  staticData: { isAuth: true, navTab: { id: 'projects', label: 'c:project_other', description: 'c:tab_projects.text' } },
  head: ({ match }) => ({ meta: [{ title: appTitle(`Projects · ${match.context.organization?.name}`) }] }),
  component: OrganizationProjectsComponent,
});
