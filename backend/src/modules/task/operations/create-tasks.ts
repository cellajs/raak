import type { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { buildStx } from '#/core/stx';
import { tenantContext, tenantRead } from '#/db/tenant-context';
import { getOrgEntityCount } from '#/modules/entities/helpers/get-entity-counts';
import { deriveDescriptionProps } from '#/modules/task/helpers/description';
import { getTaskRelations, hydrateTasks } from '#/modules/task/helpers/hydrate-task';
import { findTasksByStxMutationId, insertTasks } from '#/modules/task/task-queries';
import type { taskCreateManyStxBodySchema } from '#/modules/task/task-schema';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { checkIdempotency } from '#/utils/idempotency';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

type CreateTasksInput = z.infer<typeof taskCreateManyStxBodySchema>;
type ReturnTask = Awaited<ReturnType<typeof hydrateTasks>>[number];

export async function createTasksOp(
  ctx: AuthContext,
  input: CreateTasksInput,
): Promise<OperationResult<{ data: ReturnTask[]; rejectedIds: string[] }>> {
  const organization = ctx.var.organization;
  const taskRestrictions = ctx.var.tenant.restrictions.quotas.task;

  if (taskRestrictions !== 0 && input.length > taskRestrictions) {
    return { success: false, error: 'restrict_by_org', status: 429 };
  }

  // Idempotency check
  const batchStxId = input[0].stx.mutationId;
  const existing = await checkIdempotency(batchStxId, () =>
    tenantRead(ctx, async (readCtx) => {
      const tasks = await findTasksByStxMutationId(readCtx, { mutationId: batchStxId });
      const [users, labels] = await getTaskRelations(readCtx, { tasks });
      return hydrateTasks(tasks, users, labels);
    }),
  );
  if (existing) return { success: true, data: { data: existing, rejectedIds: [] } };

  // Check restriction limits (soft — concurrent requests may slightly overshoot)
  const currentTasksCount = await getOrgEntityCount(ctx, organization.id, 'task');

  if (taskRestrictions !== 0 && currentTasksCount + input.length > taskRestrictions) {
    return { success: false, error: 'restrict_by_org', status: 429 };
  }

  // Prepare tasks for insert
  const tasksToInsert = await Promise.all(
    input.map(async ({ stx, id, ...taskInfo }) => {
      const descriptionText = String(taskInfo.description ?? '');
      const derived = await deriveDescriptionProps(descriptionText);

      const task = {
        ...taskInfo,
        id,
        entityType: 'task' as const,
        description: descriptionText,
        ...derived,
        displayOrder: taskInfo.displayOrder ?? 0,
        tenantId: organization.tenantId,
        organizationId: organization.id,
        createdAt: getIsoDate(),
        createdBy: ctx.var.user.id,
        stx: buildStx(stx),
      };

      canCreateEntity(ctx, buildSubject('task', task));
      return task;
    }),
  );

  // Insert + hydrate inside tenantContext so RLS session vars are set
  const { createdTasks, users, labels } = await tenantContext(ctx, async (txCtx) => {
    const createdTasks = await insertTasks(txCtx, { tasks: tasksToInsert });
    const [users, labels] = await getTaskRelations(txCtx, { tasks: createdTasks });
    return { createdTasks, users, labels };
  });

  const taskResponses = hydrateTasks(createdTasks, users, labels);

  log.info('Tasks created', { count: createdTasks.length });

  return { success: true, data: { data: taskResponses, rejectedIds: [] } };
}
