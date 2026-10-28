import { AppError } from '#/core/error';
import { getAdminDb } from '#/db/db';
import { resolveEntity } from '#/modules/entities/entities-queries';
import { getTaskRelations } from '#/modules/task/operations/get-task-relations';
import { hydrateTask, type TaskResponse } from '#/modules/task/operations/hydrate-task';
import { publicReadContext } from '#/modules/task/operations/public-read-context';
import { checkAccess } from '#/permissions';
import { type AccessContext, accessFrom } from '#/permissions/access';
import { buildSubject } from '#/permissions/build-subject';

/**
 * A task a public route may serve: `publicRead()` opens it once its own `public` is set (inherited from the parent
 * project at create time, then row-local; no cascade). Public reads bypass the tenant status checks of `tenantGuard`.
 * @throws AppError 404 `not_found` for a missing task and for one the caller may not read, so the answer confirms no id.
 */
export async function getPublicTaskOp(ctx: AccessContext, id: string): Promise<TaskResponse> {
  const db = getAdminDb('public task reads');
  const task = await resolveEntity({ var: { db } }, { entityType: 'task', identifier: id });
  if (!task || !checkAccess(accessFrom(ctx), 'read', buildSubject('task', task, { id: task.id, row: task })).allowed) {
    throw new AppError(404, 'not_found', 'warn', { entityType: 'task' });
  }

  const readCtx = publicReadContext(db, task);
  const [users, labels] = await getTaskRelations(readCtx, { tasks: [task] });
  return hydrateTask(readCtx, task, users, labels);
}
