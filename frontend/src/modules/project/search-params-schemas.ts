import { zGetProjectsQuery } from 'sdk/zod.gen';
import z from 'zod';
import { entityViewSearchParam } from '~/modules/entities/entity-grid/view-mode';

export const projectsSearchDefaults = { q: '', sort: 'name', order: 'asc', view: 'grid' } as const;

// The list's own default sort is the caller's menu order, which an organization-wide table has no column for.
export const projectsRouteSearchParamsSchema = zGetProjectsQuery
  .pick({ q: true, order: true })
  .extend({ sort: z.enum(['name', 'createdAt']).optional().default('name'), view: entityViewSearchParam });
