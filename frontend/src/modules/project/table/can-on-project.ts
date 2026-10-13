import { resolveCan } from 'shared';
import type { EntityCan } from '~/modules/entities/types';
import type { EnrichedProject } from '~/modules/project/types';

/**
 * Whether the user may update or delete a project listed under its organization: an organization grant covers
 * every project, and without one the project's own membership decides.
 */
export const canOnProject = (
  action: 'update' | 'delete',
  project: EnrichedProject,
  organizationCan: EntityCan | undefined,
  userId: string | undefined,
) => {
  const createdBy = project.createdBy?.id ?? null;
  return resolveCan(organizationCan?.project?.[action], createdBy, userId) || resolveCan(project.can?.project?.[action], createdBy, userId);
};
