import type { ActorContext } from '#/core/context';
import { toWorkspaceResponse } from '#/modules/workspace/operations/to-workspace-response';
import { getValidChannel } from '#/permissions/get-valid-channel';

/**
 * A workspace by id, or by slug with `bySlug`, with the counts and the caller's membership `include` asks for.
 * @throws The refusals of `getValidChannel` for `read`.
 */
export async function getWorkspaceOp(ctx: ActorContext, id: string, opts: { bySlug?: boolean; include: string[] }) {
  const { bySlug, include } = opts;

  const { entity, membership } = await getValidChannel(ctx, id, 'workspace', 'read', bySlug);

  return toWorkspaceResponse(ctx, entity, membership, { counts: include.includes('counts'), membership: include.includes('membership') });
}
