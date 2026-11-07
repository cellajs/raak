import type { UserContext } from '#/core/context';
import { AppError } from '#/core/error';
import { findDemoByUser } from '#/modules/demo/demo-queries';
import { demoAnswer } from '#/modules/demo/operations/demo-place';

/**
 * The signed-in account's demo while it is one: where it opens, when it ends, and its share code.
 * @throws AppError 404 for an account that is no demo.
 */
export async function getDemoOp(ctx: UserContext) {
  const demo = await findDemoByUser(ctx, { userId: ctx.var.user.id });
  if (!demo) throw new AppError(404, 'not_found', 'info', { entityType: 'user' });
  return demoAnswer(demo, ctx.var.user.id);
}
