import type { MembershipBase, Project } from 'sdk';
import type { z } from 'zod';
import type { ChannelEnrichment } from '~/modules/entities/types';
import type { projectsRouteSearchParamsSchema } from '~/modules/project/search-params-schemas';

export type ProjectsRouteSearchParams = z.infer<typeof projectsRouteSearchParamsSchema>;

/** Project with the ancestor slugs cache enrichment adds. */
export type EnrichedProject = Project & ChannelEnrichment;

/** A project joined with the caller's membership in it, from `meKeys.memberships`, as a board builds its panels. */
export type ProjectWithMembership = EnrichedProject & { membership: MembershipBase | null };
