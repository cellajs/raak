import type { ActorContext } from '#/core/context';
import { withActorRef } from '#/modules/actors/actor-refs';
import { getValidChannel } from '#/permissions';

/**
 * A public project by id, or by slug with `bySlug`. `publicGuard` sets no actor, so `getValidChannel` reads as an
 * anonymous caller, whom only the public read grant lets in: a project that is not public reads as missing.
 * @throws AppError 404 `not_found` when the project is missing or not public.
 */
export async function getPublicProjectOp(ctx: ActorContext, id: string, bySlug?: boolean) {
  const { entity: project } = await getValidChannel(ctx, id, 'project', 'read', bySlug);
  const projectWithAudit = await withActorRef(ctx, project);
  return { ...projectWithAudit, membership: null, included: {} };
}
