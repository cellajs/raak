import type { z } from '@hono/zod-openapi';
import type { ActorContext, UserContext } from '#/core/context';
import { AppError } from '#/core/error';
import { tenantContext } from '#/db/tenant-context';
import { dispatchMutation } from '#/lib/mutation-bus';
import { findLabelSlugById, findLivePrimaryLabels } from '#/modules/label/label-queries';
import { deriveDescriptionProps } from '#/modules/task/helpers/description';
import { hydrateTask, hydrateTaskLite } from '#/modules/task/helpers/hydrate-task';
import { getTaskRelations } from '#/modules/task/operations/get-task-relations';
import type { InsertTaskModel } from '#/modules/task/task-db';
import { filterExistingAttachmentIds, findProjectMemberUserIds, updateTask } from '#/modules/task/task-queries';
import { taskContract, type taskUpdateStxBodySchema } from '#/modules/task/task-schema';
import { getValidProduct } from '#/permissions/get-valid-product';
import { getIsoDate } from '#/utils/iso-date';

type UpdateTaskInput = z.infer<typeof taskUpdateStxBodySchema>;

type ReturnTask = ReturnType<typeof hydrateTask>;

/** A session or a user token carries the editor's row; a service account's call only its actor. */
type UpdateTaskContext = { var: ActorContext['var'] & Partial<Pick<UserContext['var'], 'user'>> };

/**
 * Also the task's Yjs materializer: the relay calls it with `materialized` for a collaborative description.
 * `serverOrigin` stamps the fields with the server clock, for a transaction the server built (the Yjs relay).
 */
export async function updateTaskOp(
  ctx: UpdateTaskContext,
  id: string,
  input: UpdateTaskInput,
  opts: { fullResponse?: boolean; serverOrigin?: boolean; materialized?: boolean },
): Promise<ReturnTask> {
  const { ops: rawOps = {}, stx } = input;
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
      return hydrateTask(entity, users, labels);
    }

    const updateValues: Partial<InsertTaskModel> = { ...resolved.values, updatedAt: getIsoDate(), updatedBy: ctx.var.actor.id, stx: resolved.stx };

    if (resolved.values.status !== undefined && resolved.values.status !== entity.status) {
      updateValues.statusChangedAt = getIsoDate();
    }

    // When projectId changes, validate membership and clean up project-scoped fields
    if ('projectId' in resolved.values && resolved.values.projectId !== entity.projectId) {
      const newProjectId = resolved.values.projectId as string;
      const userIdsToCheck = (entity.assignedTo as string[]).filter(Boolean);
      const projectMembers = await findProjectMemberUserIds(txCtx, { projectId: newProjectId, userIds: userIdsToCheck });
      const memberSet = new Set(projectMembers.map(({ userId }) => userId));

      // Remove assignees not in the target project
      updateValues.assignedTo = (entity.assignedTo as string[]).filter((uid) => memberSet.has(uid));
      // createdBy is an org-level audit field, not project-scoped, and is immutable at the DB level.
      // Leave it on the original creator across a move.
      // Strip labels because they are project-scoped.
      updateValues.labels = [];

      // Remap the primary label into the target project: explicit op first, then matching
      // slug, then the target's default (first live primary by displayOrder).
      const targetPrimaries = await findLivePrimaryLabels(txCtx, { projectIds: [newProjectId] });
      const requestedId = resolved.values.primaryLabelId as string | undefined;
      const currentSlug = await findLabelSlugById(txCtx, entity.primaryLabelId);
      const target = targetPrimaries.find((l) => l.id === requestedId) ?? targetPrimaries.find((l) => l.slug === currentSlug) ?? targetPrimaries[0];
      if (!target) {
        throw new AppError(409, 'project_without_primary_label', 'warn', { entityType: 'task', meta: { projectId: newProjectId } });
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

    if (resolved.values.description !== undefined && derivedDescription) {
      // Drop ids that don't resolve to a live in-org attachment row (doctored or stale
      // block props must never enter the owned-embedding host array).
      derivedDescription.attachments = await filterExistingAttachmentIds(txCtx, { ids: derivedDescription.attachments });
      Object.assign(updateValues, derivedDescription);
    }

    const updatedTaskRecord = await updateTask(txCtx, { id, values: updateValues });
    await dispatchMutation(txCtx, 'task.updated', { before: [entity], after: [updatedTaskRecord], materialized });

    const isProjectMove = 'projectId' in resolved.values && resolved.values.projectId !== entity.projectId;

    // Lite path: skip relation DB queries because the frontend uses optimistic cache.
    // Project moves always need full hydration because assignedTo/labels change server-side
    if (!fullResponse && !isProjectMove) return hydrateTaskLite(updatedTaskRecord, user);

    // Full path: hydrate relations from DB (for 3rd-party consumers)
    const relationSource = 'assignedTo' in resolved.values || 'labels' in resolved.values ? updatedTaskRecord : entity;
    const [users, labels] = await getTaskRelations(txCtx, { tasks: [relationSource] });
    return hydrateTask(updatedTaskRecord, users, labels);
  });

  return taskResponse;
}
