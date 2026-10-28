import type { ActorContext } from '#/core/context';
import { tenantRead } from '#/db/tenant-context';
import { getTaskRelations } from '#/modules/task/operations/get-task-relations';
import { hydrateTask, type TaskResponse } from '#/modules/task/operations/hydrate-task';
import { getValidProduct } from '#/permissions/get-valid-product';

/**
 * One task the caller may read, hydrated with its users and labels.
 * @throws The refusals of `getValidProduct` for `read`.
 */
export async function getTaskOp(ctx: ActorContext, id: string): Promise<TaskResponse> {
  const { mainTask, users, labels } = await tenantRead(ctx, async (readCtx) => {
    const { entity: mainTask } = await getValidProduct(readCtx, id, 'task', 'read');
    const [users, labels] = await getTaskRelations(readCtx, { tasks: [mainTask] });
    return { mainTask, users, labels };
  });

  return hydrateTask(ctx, mainTask, users, labels);
}
