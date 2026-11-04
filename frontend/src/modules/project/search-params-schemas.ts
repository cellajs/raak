import { zGetProjectsQuery } from 'sdk/zod.gen';
import { z } from 'zod';
import { listSearchDefaults, listSearchSchema } from '~/modules/common/search-params-schemas';
import { entityViewSearchParam } from '~/modules/entities/entity-grid/view-mode';

/** The API's default: the caller's menu order. */
export const projectsListSearchDefaults = listSearchDefaults(zGetProjectsQuery);

export const projectsSearchDefaults = { ...projectsListSearchDefaults, sort: 'name', view: 'grid' } as const;

// The list's own default sort is the caller's menu order, which an organization-wide table has no column for.
export const projectsRouteSearchParamsSchema = listSearchSchema(zGetProjectsQuery, projectsSearchDefaults).extend({
  sort: z.enum(['name', 'createdAt']).default(projectsSearchDefaults.sort).catch(projectsSearchDefaults.sort),
  view: entityViewSearchParam,
});
