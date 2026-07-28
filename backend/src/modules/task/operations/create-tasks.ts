import type { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import type { OperationResult } from '#/core/operation-result';
import { buildStx } from '#/core/stx';
import { tenantContext, tenantRead } from '#/db/tenant-context';
import { getOrgEntityCount } from '#/modules/entities/entities-queries';
import { findLivePrimaryLabels } from '#/modules/label/helpers/primary-labels';
import { deriveDescriptionProps } from '#/modules/task/helpers/description';
import { getTaskRelations, hydrateTasks } from '#/modules/task/helpers/hydrate-task';
import { findTasksByStxMutationId, insertTasks } from '#/modules/task/task-queries';
import { taskContract, type taskCreateManyStxBodySchema } from '#/modules/task/task-schema';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { checkIdempotency } from '#/utils/idempotency';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

type CreateTasksInput = z.infer<typeof taskCreateManyStxBodySchema>;
type ReturnTask = Awaited<ReturnType<typeof hydrateTasks>>[number];

export async function createTasksOp(
  ctx: AuthContext,
  rawInput: CreateTasksInput,
): Promise<OperationResult<{ data: ReturnTask[]; rejectedIds: string[] }>> {
  // Lens seam: canonicalize old-shape field names before any body access
  const input = rawInput.map((item) => taskContract.normalizeCreateItem(item));
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

  // Check restriction limits. Concurrent requests may slightly overshoot.
  const currentTasksCount = await getOrgEntityCount(ctx, organization.id, 'task');

  if (taskRestrictions !== 0 && currentTasksCount + input.length > taskRestrictions) {
    return { success: false, error: 'restrict_by_org', status: 429 };
  }

  // Resolve primary labels per project: validate provided ids, default to first by displayOrder
  const projectIds = [...new Set(input.map((item) => item.projectId))];
  const primaryLabelRows = await tenantRead(ctx, (readCtx) => findLivePrimaryLabels(readCtx, { projectIds }));
  const primariesByProject = new Map<string, typeof primaryLabelRows>();
  for (const row of primaryLabelRows) {
    primariesByProject.set(row.projectId, [...(primariesByProject.get(row.projectId) ?? []), row]);
  }

  // Prepare tasks for insert
  const tasksToInsert = await Promise.all(
    input.map(async ({ stx, id, ...taskInfo }) => {
      const descriptionText = String(taskInfo.description ?? '');
      const derived = await deriveDescriptionProps(descriptionText);

      const projectPrimaries = primariesByProject.get(taskInfo.projectId) ?? [];
      // Unknown/missing ids fall back to the project default (graceful for offline replays)
      const primaryLabelId = projectPrimaries.some((l) => l.id === taskInfo.primaryLabelId)
        ? (taskInfo.primaryLabelId as string)
        : projectPrimaries[0]?.id;
      if (!primaryLabelId) {
        throw new AppError(400, 'invalid_request', 'warn', {
          entityType: 'task',
          meta: { reason: 'Project has no primary labels' },
        });
      }

      const task = {
        ...taskInfo,
        id,
        primaryLabelId,
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
