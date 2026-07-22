import type { Project } from 'sdk';
import type { ChannelEnrichment } from '~/modules/entities/types';

/** Frontend-enriched project type with client-side cache enrichment fields. */
export type EnrichedProject = Project & ChannelEnrichment;
