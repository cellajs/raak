import type { z } from '@hono/zod-openapi';
import type { ActorContext } from '#/core/context';
import { AppError } from '#/core/error';
import { updateStamps } from '#/db/utils/stamps';
import { releaseReplacedImages } from '#/modules/attachment/operations/release-replaced-images';
import { checkSlugAvailable } from '#/modules/entities/operations/check-slug';
import { toProjectResponse } from '#/modules/project/operations/to-project-response';
import { updateProject } from '#/modules/project/project-queries';
import { projectContract, type projectUpdateBodySchema } from '#/modules/project/project-schema';
import { getValidChannel } from '#/permissions';
import { log } from '#/utils/logger';

/**
 * Updates a project and returns it with its counts and the caller's membership.
 * @throws The refusals of `getValidChannel` for `update`; 409 `slug_exists` when another row holds the new slug.
 */
export async function updateProjectOp(ctx: ActorContext, id: string, rawInput: z.infer<typeof projectUpdateBodySchema>) {
  const input = projectContract.normalizeBody(rawInput);

  const { entity: project, membership } = await getValidChannel(ctx, id, 'project', 'update');

  const { slug } = input;

  if (slug && slug !== project.slug) {
    const slugAvailable = await checkSlugAvailable(ctx, slug, 'project');
    if (!slugAvailable) throw new AppError(409, 'slug_exists', 'warn', { entityType: 'project', meta: { slug } });
  }

  const values = { ...input, ...updateStamps(ctx.var.actor.id) };
  const updatedProjectRecord = await updateProject(ctx, { id: project.id, values });
  await releaseReplacedImages({ holder: { organizationId: project.organizationId, tenantId: project.tenantId }, before: project, after: input });

  log.info('Project updated', { projectId: updatedProjectRecord.id });

  return toProjectResponse(ctx, updatedProjectRecord, membership, { counts: true, membership: true });
}
