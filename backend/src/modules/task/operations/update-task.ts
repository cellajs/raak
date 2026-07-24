import type { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import type { OperationResult } from '#/core/operation-result';
import { tenantContext } from '#/db/tenant-context';
import { findLabelSlugById, findLivePrimaryLabels } from '#/modules/label/helpers/primary-labels';
import {
  type DerivedDescriptionProps,
  deriveDescriptionProps,
  type ParsedBlock,
  removeAttachments,
} from '#/modules/task/helpers/description';
import { getTaskRelations, hydrateTask, hydrateTaskLite } from '#/modules/task/helpers/hydrate-task';
import type { InsertTaskModel } from '#/modules/task/task-db';
import { findProjectMemberUserIds, updateTask } from '#/modules/task/task-queries';
import { taskContract, type taskUpdateStxBodySchema } from '#/modules/task/task-schema';
import { getValidProduct } from '#/permissions/get-valid-product';
import { getIsoDate } from '#/utils/iso-date';
import { assertBlockMediaUrls } from '#/utils/validate-block-urls';

type UpdateTaskInput = z.infer<typeof taskUpdateStxBodySchema>;

type ReturnTask = ReturnType<typeof hydrateTask>;

export async function updateTaskOp(
  ctx: AuthContext,
  id: string,
  input: UpdateTaskInput,
  opts: { fullResponse?: boolean; serverOrigin?: boolean },
): Promise<OperationResult<ReturnTask>> {
  const { ops: rawOps = {}, stx } = input;
  const { fullResponse, serverOrigin } = opts;
  const user = ctx.var.user;

  // Pre-compute description metadata outside the transaction to avoid holding a DB
  // connection during CPU-intensive BlockNote HTML conversion + keyword extraction
  let derivedDescription: DerivedDescriptionProps | undefined;
  let parsedBlocks: ParsedBlock[] | undefined;
  if ('description' in rawOps) {
    const description = rawOps.description;
    if (description) {
      // Validate media URLs in description are from trusted sources (CDN only)
      assertBlockMediaUrls(description as string, 'task', 'description');

      parsedBlocks = JSON.parse(description as string);
      derivedDescription = await deriveDescriptionProps(description as string, parsedBlocks);
    } else {
      derivedDescription = await deriveDescriptionProps('');
    }
  }

  // Single tenantContext wraps permission check + write to avoid double-transaction pool pressure
  const taskResponse = await tenantContext(ctx, async (txCtx) => {
    const { entity } = await getValidProduct(txCtx, id, 'task', 'update');

    // Server-origin writes (Yjs description materialization) carry no client field
    // timestamps, so they stamp a fresh server HLC for every changed scalar instead of
    // resolving against client HLCs.
    const resolved = serverOrigin
      ? taskContract.resolveServerUpdateOps(entity, rawOps)
      : taskContract.resolveUpdateOps(entity, rawOps, stx);

    // Skip DB update if nothing changed
    if (!resolved.changed) {
      if (!fullResponse) return hydrateTaskLite(entity, user);
      const [users, labels] = await getTaskRelations(txCtx, { tasks: [entity] });
      return hydrateTask(entity, users, labels);
    }

    const updateValues: Partial<InsertTaskModel> = {
      ...resolved.values,
      updatedAt: getIsoDate(),
      updatedBy: user.id,
      stx: resolved.stx,
    };

    if (resolved.values.status !== undefined && resolved.values.status !== entity.status) {
      updateValues.statusChangedAt = getIsoDate();
    }

    // When projectId changes, validate membership and clean up project-scoped fields
    if ('projectId' in resolved.values && resolved.values.projectId !== entity.projectId) {
      const newProjectId = resolved.values.projectId as string;
      const userIdsToCheck = [...(entity.assignedTo as string[]), entity.createdBy as string].filter(Boolean);
      const projectMembers = await findProjectMemberUserIds(txCtx, {
        projectId: newProjectId,
        userIds: userIdsToCheck,
      });
      const memberSet = new Set(projectMembers.map(({ userId }) => userId));

      // Remove assignees not in the target project
      updateValues.assignedTo = (entity.assignedTo as string[]).filter((uid) => memberSet.has(uid));
      // Reassign creator if they're not a member of the target project
      updateValues.createdBy =
        entity.createdBy && memberSet.has(entity.createdBy as string) ? (entity.createdBy as string) : user.id;
      // Strip labels because they are project-scoped.
      updateValues.labels = [];

      // Remap the primary label into the target project: explicit op first, then matching
      // slug, then the target's default (first live primary by displayOrder).
      const targetPrimaries = await findLivePrimaryLabels(txCtx, { projectIds: [newProjectId] });
      const requestedId = resolved.values.primaryLabelId as string | undefined;
      const currentSlug = await findLabelSlugById(txCtx, entity.primaryLabelId);
      const target =
        targetPrimaries.find((l) => l.id === requestedId) ??
        targetPrimaries.find((l) => l.slug === currentSlug) ??
        targetPrimaries[0];
      if (!target) {
        throw new AppError(400, 'invalid_request', 'warn', {
          entityType: 'task',
          meta: { reason: 'Target project has no primary labels' },
        });
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

    if (resolved.values.description !== undefined) {
      if (parsedBlocks) await removeAttachments(txCtx, { blocks: parsedBlocks, entityId: id, deletedBy: user.id });
      if (derivedDescription) Object.assign(updateValues, derivedDescription);
    }

    const updatedTaskRecord = await updateTask(txCtx, { id, values: updateValues });

    const isProjectMove = 'projectId' in resolved.values && resolved.values.projectId !== entity.projectId;

    // Lite path: skip relation DB queries because the frontend uses optimistic cache.
    // Project moves always need full hydration because assignedTo/labels change server-side
    if (!fullResponse && !isProjectMove) return hydrateTaskLite(updatedTaskRecord, user);

    // Full path: hydrate relations from DB (for 3rd-party consumers)
    const relationSource = 'assignedTo' in resolved.values || 'labels' in resolved.values ? updatedTaskRecord : entity;
    const [users, labels] = await getTaskRelations(txCtx, { tasks: [relationSource] });
    return hydrateTask(updatedTaskRecord, users, labels);
  });

  return { success: true, data: taskResponse };
}
