import type { z } from '@hono/zod-openapi';
import type { OrgContext, UserContext } from '#/core/context';
import { AppError } from '#/core/error';
import { tenantContext } from '#/db/tenant-context';
import { updateStamps } from '#/db/utils/stamps';
import { dispatchMutation } from '#/lib/mutation-bus';
import { filterExistingProductIds } from '#/modules/entities/embedding-queries';
import { findLabelSlugById, findLivePrimaryLabels } from '#/modules/label/label-queries';
import { deriveDescriptionProps } from '#/modules/task/helpers/description';
import { getTaskRelations } from '#/modules/task/operations/get-task-relations';
import { hydrateTask, hydrateTaskLite, type TaskResponse } from '#/modules/task/operations/hydrate-task';
import { projectRelationFilter } from '#/modules/task/operations/project-relations';
import type { InsertTaskModel } from '#/modules/task/task-db';
import { updateTask } from '#/modules/task/task-queries';
import { taskContract, type taskUpdateStxBodySchema } from '#/modules/task/task-schema';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { getValidProduct } from '#/permissions/get-valid-product';
import { resolvePlacement } from '#/permissions/product-placement';
import { getIsoDate } from '#/utils/iso-date';

type UpdateTaskInput = z.infer<typeof taskUpdateStxBodySchema>;

/** A session or a user token carries the editor's row; a service account's call only its actor. */
type UpdateTaskContext = { var: OrgContext['var'] & Partial<Pick<UserContext['var'], 'user'>> };

/**
 * Also the task's Yjs materializer: `materializeDescriptionOp` calls it with `materialized` for a collaborative
 * description the relay posts. `serverOrigin` stamps the fields with the server clock, for a transaction the server
 * built (the Yjs relay).
 */
export async function updateTaskOp(
  ctx: UpdateTaskContext,
  id: string,
  input: UpdateTaskInput,
  opts: { fullResponse?: boolean; serverOrigin?: boolean; materialized?: boolean },
): Promise<TaskResponse> {
  const { ops: rawOps, stx } = input;
  const { fullResponse, serverOrigin, materialized } = opts;
  const user = ctx.var.user;

  // A cleared description derives empty counts and an empty attachments array, so the
  // CDC worker garbage-collects attachments the description no longer references.
  const derivedDescription = 'description' in rawOps ? deriveDescriptionProps(rawOps.description as string | null) : undefined;

  // Single tenantContext wraps permission check + write to avoid double-transaction pool pressure
  const taskResponse = await tenantContext(ctx, async (txCtx) => {
    // Locked: the merge below starts from this row, so no other write may land between the read and the update.
    const { entity } = await getValidProduct(txCtx, id, 'task', 'update', { forUpdate: true });

    taskContract.assertBlockFields(rawOps, entity.organizationId);

    // Server-origin writes (Yjs description materialization) carry no client field
    // timestamps, so every changed scalar gets a fresh server HLC.
    const resolved = serverOrigin ? taskContract.resolveServerUpdateOps(entity, rawOps) : taskContract.resolveUpdateOps(entity, rawOps, stx);

    // Skip DB update if nothing changed
    if (!resolved.changed) {
      if (!fullResponse) return hydrateTaskLite(entity, user);
      const [users, labels] = await getTaskRelations(txCtx, { tasks: [entity] });
      return hydrateTask(txCtx, entity, users, labels);
    }

    const updateValues: Partial<InsertTaskModel> = { ...resolved.values, ...updateStamps(ctx.var.actor.id), stx: resolved.stx };

    if (resolved.values.status !== undefined && resolved.values.status !== entity.status) {
      updateValues.statusChangedAt = getIsoDate();
    }

    const isProjectMove = 'projectId' in resolved.values && resolved.values.projectId !== entity.projectId;
    let projectId = entity.projectId;

    if (isProjectMove) {
      // A move places the task as a create does, so the actor needs the create grant in the target project.
      const { columns } = await resolvePlacement({ var: { ...ctx.var, db: txCtx.var.db } }, 'task', resolved.values);
      canCreateEntity(txCtx, buildSubject('task', { ...entity, ...columns }));
      Object.assign(updateValues, columns);
      projectId = columns.projectId;
      // createdBy is an org-level audit field, not project-scoped, and is immutable at the DB level.
      // Leave it on the original creator across a move.

      // Remap the primary label into the target project: explicit op first, then matching
      // slug, then the target's default (first live primary by displayOrder).
      const targetPrimaries = await findLivePrimaryLabels(txCtx, { projectIds: [projectId] });
      const requestedId = resolved.values.primaryLabelId as string | undefined;
      const currentSlug = await findLabelSlugById(txCtx, entity.primaryLabelId);
      const target = targetPrimaries.find((l) => l.id === requestedId) ?? targetPrimaries.find((l) => l.slug === currentSlug) ?? targetPrimaries[0];
      if (!target) {
        throw new AppError(409, 'project_without_primary_label', 'warn', { entityType: 'task', meta: { projectId } });
      }
      updateValues.primaryLabelId = target.id;
    } else if ('primaryLabelId' in resolved.values) {
      // Validate the new primary label is a live primary of the task's project
      const projectPrimaries = await findLivePrimaryLabels(txCtx, { projectIds: [entity.projectId] });
      if (!projectPrimaries.some((l) => l.id === resolved.values.primaryLabelId)) {
        throw new AppError(400, 'invalid_request', 'warn', {
          entityType: 'task',
          meta: { reason: 'Primary label does not belong to the task project' },
        });
      }
    }

    // Assignees and labels belong to the task's project: an id the row holds there stays, any other must name a member
    // or a live label of it. After a move the row holds none there.
    if (isProjectMove || resolved.values.assignedTo || resolved.values.labels) {
      const held = (column: 'assignedTo' | 'labels', relationId: string) => !isProjectMove && entity[column].includes(relationId);
      const proposed = { assignedTo: resolved.values.assignedTo ?? entity.assignedTo, labels: resolved.values.labels ?? entity.labels };
      const allows = await projectRelationFilter(txCtx, {
        projectIds: [projectId],
        userIds: proposed.assignedTo.filter((userId) => !held('assignedTo', userId)),
        labelIds: proposed.labels.filter((labelId) => !held('labels', labelId)),
      });
      for (const column of ['assignedTo', 'labels'] as const) {
        if (!isProjectMove && !resolved.values[column]) continue;
        updateValues[column] = proposed[column].filter((relationId) => held(column, relationId) || allows(column, projectId, relationId));
      }
    }

    if (resolved.values.description !== undefined && derivedDescription) {
      // Drop ids that don't resolve to a live in-org attachment row (doctored or stale
      // block props must never enter the owned-embedding host array).
      derivedDescription.attachments = await filterExistingProductIds(txCtx, { entityType: 'attachment', ids: derivedDescription.attachments });
      Object.assign(updateValues, derivedDescription);
    }

    const updatedTaskRecord = await updateTask(txCtx, { id, values: updateValues });
    await dispatchMutation(txCtx, 'task.updated', { before: [entity], after: [updatedTaskRecord], materialized });

    // Lite path: skip relation DB queries because the frontend uses optimistic cache.
    // Project moves always need full hydration because assignedTo/labels change server-side
    if (!fullResponse && !isProjectMove) return hydrateTaskLite(updatedTaskRecord, user);

    // Full path: hydrate relations from DB (for 3rd-party consumers)
    const [users, labels] = await getTaskRelations(txCtx, { tasks: [updatedTaskRecord] });
    return hydrateTask(txCtx, updatedTaskRecord, users, labels);
  });

  return taskResponse;
}
