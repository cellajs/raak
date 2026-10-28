import type { z } from '@hono/zod-openapi';
import { AppError } from '#/core/error';
import { getAdminDb } from '#/db/db';
import { resolveEntity } from '#/modules/entities/entities-queries';
import { getTasks } from '#/modules/task/operations/list-tasks';
import { publicReadContext } from '#/modules/task/operations/public-read-context';
import type { publicTaskListQuerySchema } from '#/modules/task/task-schema';

type GetPublicTasksInput = z.infer<typeof publicTaskListQuerySchema>;

/**
 * A page of a project's public tasks. The project is resolved for its organization scope only: its own `public` does
 * not gate the list. Public reads bypass the tenant status checks of `tenantGuard`.
 * @throws AppError 404 `not_found` for a missing project.
 */
export async function getPublicTasksOp(input: GetPublicTasksInput): Promise<Awaited<ReturnType<typeof getTasks>>> {
  const { projectId, ...queryInfo } = input;
  const db = getAdminDb('public task reads');
  const project = await resolveEntity({ var: { db } }, { entityType: 'project', identifier: projectId });
  if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });

  return getTasks(publicReadContext(db, project), [project.id], queryInfo, { publicOnly: true });
}
