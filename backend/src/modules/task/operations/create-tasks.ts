import type { z } from '@hono/zod-openapi';
import type { OrgContext } from '#/core/context';
import { AppError } from '#/core/error';
import { buildStx } from '#/core/stx';
import { tenantContext, tenantRead } from '#/db/tenant-context';
import { dispatchMutation } from '#/lib/mutation-bus';
import { countTenantEntityRows } from '#/modules/entities/entities-queries';
import { findLivePrimaryLabels } from '#/modules/label/label-queries';
import { deriveDescriptionProps } from '#/modules/task/helpers/description';
import { getTaskRelations } from '#/modules/task/operations/get-task-relations';
import { hydrateTasks } from '#/modules/task/operations/hydrate-task';
import { type TaskModel, tasksTable } from '#/modules/task/task-db';
import { insertTasks } from '#/modules/task/task-queries';
import { taskContract, type taskCreateManyStxBodySchema } from '#/modules/task/task-schema';
import { assertTenantQuota } from '#/modules/tenants/tenant-restrictions';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { type PlacementHome, type ResolvedPlacement, resolvePlacement } from '#/permissions/product-placement';
import { checkIdempotency } from '#/utils/idempotency';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

type CreateTasksInput = z.infer<typeof taskCreateManyStxBodySchema>;
type ReturnTask = Awaited<ReturnType<typeof hydrateTasks>>[number];

/**
 * Creates the tasks of a batch, each placed in its project with a primary label. An item an earlier attempt of this
 * create wrote comes back as its stored row; an item neither created nor the caller's live row is listed in `rejectedIds`.
 * @returns The hydrated rows, the rejected ids, and `created` when this request inserted a row.
 * @throws AppError 403 `restrict_by_app` past the tenant's task quota; 409 `project_without_primary_label`.
 */
export async function createTasksOp(
  ctx: OrgContext,
  rawInput: CreateTasksInput,
): Promise<{ data: ReturnTask[]; rejectedIds: string[]; created: boolean }> {
  const input = rawInput.map((item) => taskContract.normalizeCreateItem(item));
  const organization = ctx.var.organization;

  const hydrate = async (tasks: TaskModel[]) => {
    const [users, labels] = await tenantRead(ctx, (readCtx) => getTaskRelations(readCtx, { tasks }));
    return hydrateTasks(ctx, tasks, users, labels);
  };

  // Rows an earlier attempt of this create wrote come back as they are; only the other items are created.
  const replayed = await checkIdempotency(
    ctx,
    tasksTable,
    input.map((item) => item.id),
  );
  const replayedIds = new Set(replayed.map((row) => row.id));
  const fresh = input.filter((item) => !replayedIds.has(item.id));
  if (fresh.length === 0) return { data: await hydrate(replayed), rejectedIds: [], created: false };

  const currentTasks = await countTenantEntityRows(ctx, { entityType: 'task' });
  assertTenantQuota(ctx, 'task', currentTasks, fresh.length);

  const placements: ResolvedPlacement<'task'>[] = [];
  const homes: (PlacementHome | null)[] = [];
  for (const item of fresh) {
    const { columns, home } = await resolvePlacement(ctx, 'task', item);
    placements.push(columns);
    homes.push(home);
  }

  // Resolve primary labels per project: validate provided ids, default to first by displayOrder
  const projectIds = [...new Set(placements.map(({ projectId }) => projectId))];
  const primaryLabelRows = await tenantRead(ctx, (readCtx) => findLivePrimaryLabels(readCtx, { projectIds }));
  const primariesByProject = new Map<string, typeof primaryLabelRows>();
  for (const row of primaryLabelRows) {
    primariesByProject.set(row.projectId, [...(primariesByProject.get(row.projectId) ?? []), row]);
  }

  const tasksToInsert = fresh.map(({ stx, id, ...taskInfo }, index) => {
    const placement = placements[index];
    // Derived attachments are UUID-shape-checked only: attachment rows created in the
    // same client batch may not be committed yet, so existence is not enforced here.
    taskContract.assertBlockFields(taskInfo, organization.id);
    const descriptionText = String(taskInfo.description ?? '');
    const derived = deriveDescriptionProps(descriptionText);

    const projectPrimaries = primariesByProject.get(placement.projectId) ?? [];
    // Unknown/missing ids fall back to the project default (graceful for offline replays)
    const primaryLabelId = projectPrimaries.some((l) => l.id === taskInfo.primaryLabelId)
      ? (taskInfo.primaryLabelId as string)
      : projectPrimaries[0]?.id;
    if (!primaryLabelId) {
      throw new AppError(409, 'project_without_primary_label', 'warn', { entityType: 'task', meta: { projectId: placement.projectId } });
    }

    const task = {
      ...taskInfo,
      id,
      primaryLabelId,
      entityType: 'task' as const,
      description: descriptionText,
      ...derived,
      ...placement,
      // Public read is the project's decision, copied onto the row; a client cannot widen it.
      public: homes[index]?.entity.public ?? false,
      displayOrder: taskInfo.displayOrder ?? 0,
      tenantId: organization.tenantId,
      organizationId: organization.id,
      createdAt: getIsoDate(),
      createdBy: ctx.var.actor.id,
      stx: buildStx(stx),
    };

    canCreateEntity(ctx, buildSubject('task', task));
    return task;
  });

  const createdTasks = await tenantContext(ctx, async (txCtx) => {
    const rows = await insertTasks(txCtx, { tasks: tasksToInsert });
    await dispatchMutation(txCtx, 'task.created', { after: rows });
    return rows;
  });

  log.info('Tasks created', { count: createdTasks.length });

  // An attempt of this create running at the same time and committing first leaves this insert without those rows; any
  // other id left out names a row that is not the caller's live one (another actor's, or a deleted one) and is rejected.
  const insertedIds = new Set(createdTasks.map((row) => row.id));
  const missingIds = fresh.map((item) => item.id).filter((id) => !insertedIds.has(id));
  const committedMeanwhile = missingIds.length > 0 ? await checkIdempotency(ctx, tasksTable, missingIds) : [];
  const committedIds = new Set(committedMeanwhile.map((row) => row.id));

  return {
    data: await hydrate([...replayed, ...createdTasks, ...committedMeanwhile]),
    rejectedIds: missingIds.filter((id) => !committedIds.has(id)),
    created: createdTasks.length > 0,
  };
}
