import type { Project } from 'sdk';
import type z from 'zod';
import type { ChannelEnrichment } from '~/modules/entities/types';
import type { projectsRouteSearchParamsSchema } from '~/modules/project/search-params-schemas';

export type ProjectsRouteSearchParams = z.infer<typeof projectsRouteSearchParamsSchema>;

/** Project with the membership, permissions and ancestor slugs the cache adds. */
export type EnrichedProject = Project & ChannelEnrichment;
