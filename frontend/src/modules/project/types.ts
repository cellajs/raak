import type { Project } from 'sdk';
import type { EntityEnrichment } from '~/modules/entities/types';

/** Frontend-enriched project type with client-side cache enrichment fields. */
export type EnrichedProject = Project & EntityEnrichment;
