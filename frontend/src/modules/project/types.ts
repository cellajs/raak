import type { Project } from 'sdk';
import type z from 'zod';
import type { ChannelEnrichment } from '~/modules/entities/types';
import type { projectsRouteSearchParamsSchema } from '~/modules/project/search-params-schemas';

export type ProjectsRouteSearchParams = z.infer<typeof projectsRouteSearchParamsSchema>;

/** Frontend-enriched project type with client-side cache enrichment fields. */
export type EnrichedProject = Project & ChannelEnrichment;
