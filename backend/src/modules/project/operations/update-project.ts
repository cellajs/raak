import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import { tenantContext } from '#/db/tenant-context';
import { dispatchMutation } from '#/lib/mutation-bus';
import { getChannelCounts } from '#/modules/entities/entities-queries';
import { checkSlugAvailable } from '#/modules/entities/helpers/check-slug';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { updateProject } from '#/modules/project/project-queries';
import { projectContract } from '#/modules/project/project-schema';
import { getTaskStatusCounts } from '#/modules/task/helpers/get-task-status-counts';
import { withAuditUser } from '#/modules/user/helpers/audit-user';
import { getValidChannel } from '#/permissions';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

export async function updateProjectOp(ctx: AuthContext, id: string, rawInput: Record<string, unknown>) {
  // Lens seam: canonicalize old-shape field names before any body access
  const input = projectContract.normalizeBody(rawInput);
  const user = ctx.var.user;

  const { entity: project, membership } = await getValidChannel(ctx, id, 'project', 'update');

  const slug = input.slug as string | undefined;

  if (slug && slug !== project.slug) {
    const slugAvailable = await checkSlugAvailable(ctx, slug, 'project');
    if (!slugAvailable) throw new AppError(409, 'slug_exists', 'warn', { entityType: 'project', meta: { slug } });
  }

  const values = { ...input, updatedAt: getIsoDate(), updatedBy: user.id };
  // Update the project and cascade a public_at change onto its children in one transaction, so
  // publish/unpublish and the child rewrite commit together (replaces the AFTER UPDATE trigger).
  const updatedProjectRecord = await tenantContext(ctx, async (txCtx) => {
    const record = await updateProject(txCtx, { id: project.id, values });
    await dispatchMutation(txCtx, 'project.updated', { before: [project], after: [record] });
    return record;
  });

  log.info('Project updated', { projectId: updatedProjectRecord.id });

  // Get updated counts
  const [counts, taskStatusCounts] = await Promise.all([
    getChannelCounts(ctx, 'project', updatedProjectRecord.id),
    getTaskStatusCounts(ctx, updatedProjectRecord.id),
  ]);

  const projectWithAudit = await withAuditUser(ctx, updatedProjectRecord, user);
  const included = {
    ...(membership && { membership: toMembershipBase(membership) }),
    counts: { ...counts, taskStatusCounts },
  };

  return { ...projectWithAudit, included };
}
