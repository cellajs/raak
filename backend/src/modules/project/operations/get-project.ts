import type { ActorContext } from '#/core/context';
import { toProjectResponse } from '#/modules/project/operations/to-project-response';
import { getValidChannel } from '#/permissions';

/**
 * A project by id, or by slug with `bySlug`, with the counts and the caller's membership `include` asks for.
 * @throws The refusals of `getValidChannel` for `read`.
 */
export async function getProjectOp(ctx: ActorContext, id: string, opts: { bySlug?: boolean; include: string[] }) {
  const { bySlug, include } = opts;

  const { entity, membership } = await getValidChannel(ctx, id, 'project', 'read', bySlug);

  return toProjectResponse(ctx, entity, membership, { counts: include.includes('counts'), membership: include.includes('membership') });
}
