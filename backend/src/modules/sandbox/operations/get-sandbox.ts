import type { UserContext } from '#/core/context';
import { AppError } from '#/core/error';
import { sandboxAnswer } from '#/modules/sandbox/operations/sandbox-place';
import { findSandboxByUser } from '#/modules/sandbox/sandbox-queries';

/**
 * The signed-in account's sandbox while it is one: where it opens and when it ends.
 * @throws AppError 404 for an account that is no sandbox, a kept one included.
 */
export async function getSandboxOp(ctx: UserContext) {
  const sandbox = await findSandboxByUser(ctx, { userId: ctx.var.user.id });
  if (sandbox?.status !== 'claimed') throw new AppError(404, 'not_found', 'info', { entityType: 'user' });
  return sandboxAnswer(sandbox);
}
