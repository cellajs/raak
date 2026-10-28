import type { DbContext } from '#/core/context';
import { AppError } from '#/core/error';
import { findLiveTaskById, findTaskLinkTarget } from '#/modules/task/task-queries';

/** Routing metadata of a task link, read outside a tenant: the caller passes a context that is not scoped by RLS. */
export const resolveTaskLink = async (ctx: DbContext, id: string) => {
  const task = await findLiveTaskById(ctx, { id });
  if (!task) throw new AppError(404, 'not_found', 'warn', { entityType: 'task' });

  const target = await findTaskLinkTarget(ctx, { projectId: task.projectId });
  if (!target) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });

  return {
    taskId: id,
    projectId: task.projectId,
    projectSlug: target.slug,
    organizationId: target.organizationId,
    organizationSlug: target.organizationSlug,
    tenantId: target.tenantId,
    public: target.public,
  };
};
