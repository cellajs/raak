import type { UserContext } from '#/core/context';
import { deleteProjectsOp } from '#/modules/project/operations/delete-projects';
import { deleteSamplePersonMemberships, findSampleProjects } from '#/modules/sample/sample-queries';
import { log } from '#/utils/logger';

/**
 * Deletes the organization's sample projects the caller may delete, with their tasks. Once none is left, the sample
 * people leave the organization.
 * @returns The sample project ids the caller may not delete, as `rejectedIds`.
 */
export async function removeSampleOp(ctx: UserContext) {
  const { organization } = ctx.var;
  const projects = await findSampleProjects(ctx, { organizationId: organization.id });
  const { rejectedIds } = await deleteProjectsOp(
    ctx,
    projects.map(({ id }) => id),
  );

  if (rejectedIds.length === 0) {
    const removed = await deleteSamplePersonMemberships(ctx, { organizationId: organization.id });
    log.info('Sample removed', { organizationId: organization.id, memberships: removed.length });
  }

  return { data: [], rejectedIds };
}
