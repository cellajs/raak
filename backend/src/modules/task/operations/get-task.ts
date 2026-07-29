import type { AuthContext } from '#/core/context';
import { tenantRead } from '#/db/tenant-context';
import { getTaskRelations, hydrateTask } from '#/modules/task/helpers/hydrate-task';
import { getValidProduct } from '#/permissions/get-valid-product';

type ReturnTask = ReturnType<typeof hydrateTask>;

export async function getTaskOp(ctx: AuthContext, id: string): Promise<ReturnTask> {
  const { mainTask, users, labels } = await tenantRead(ctx, async (readCtx) => {
    const { entity: mainTask } = await getValidProduct(readCtx, id, 'task', 'read');
    const [users, labels] = await getTaskRelations(readCtx, { tasks: [mainTask] });
    return { mainTask, users, labels };
  });

  return hydrateTask(mainTask, users, labels);
}
