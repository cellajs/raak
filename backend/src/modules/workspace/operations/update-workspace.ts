import type { z } from '@hono/zod-openapi';
import type { ActorContext } from '#/core/context';
import { updateStamps } from '#/db/utils/stamps';
import { toWorkspaceResponse } from '#/modules/workspace/operations/to-workspace-response';
import { updateWorkspace } from '#/modules/workspace/workspace-queries';
import { workspaceContract, type workspaceUpdateBodySchema } from '#/modules/workspace/workspace-schema';
import { getValidChannel } from '#/permissions/get-valid-channel';
import { log } from '#/utils/logger';

/**
 * Updates a workspace and returns it with its counts and the caller's membership.
 * @throws The refusals of `getValidChannel` for `update`.
 */
export async function updateWorkspaceOp(ctx: ActorContext, id: string, rawInput: z.infer<typeof workspaceUpdateBodySchema>) {
  const input = workspaceContract.normalizeBody(rawInput);

  const { entity: workspace, membership } = await getValidChannel(ctx, id, 'workspace', 'update');

  const values = { ...input, ...updateStamps(ctx.var.actor.id) };
  const updatedWorkspaceRecord = await updateWorkspace(ctx, { id: workspace.id, values });

  log.info('Workspace updated', { workspaceId: updatedWorkspaceRecord.id });

  return toWorkspaceResponse(ctx, updatedWorkspaceRecord, membership, { counts: true, membership: true });
}
