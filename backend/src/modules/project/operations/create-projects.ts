import type { z } from '@hono/zod-openapi';
import type { UserContext } from '#/core/context';
import { tenantContext } from '#/db/tenant-context';
import { dispatchMutation } from '#/lib/mutation-bus';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { userActorRef, withActorRefs } from '#/modules/actors/actor-refs';
import { countTenantEntityRows } from '#/modules/entities/entities-queries';
import { buildZeroCounts } from '#/modules/entities/helpers/build-zero-counts';
import { checkSlugsAvailable } from '#/modules/entities/operations/check-slug';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { insertMemberships } from '#/modules/memberships/operations/insert-memberships';
import { resolveProjectWorkspaceId } from '#/modules/project/operations/project-workspace-membership';
import { insertProjects } from '#/modules/project/project-queries';
import { projectContract, type projectCreateBodySchema } from '#/modules/project/project-schema';
import { assertTenantQuota } from '#/modules/tenants/tenant-restrictions';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { log } from '#/utils/logger';
import { filterWithRejection } from '#/utils/rejection-utils';

const defaultTaskStatusCounts = { accepted: 0, reviewed: 0, delivered: 0, finished: 0, started: 0, unstarted: 0, iced: 0 };

type CreateProjectItem = z.infer<typeof projectCreateBodySchema>[number];

/**
 * Creates projects in the organization, filed under the caller's workspace, each with its creator as admin. An item
 * whose slug is taken is rejected as `slug_exists`.
 * @throws AppError 403 `restrict_by_app` past the tenant's project quota.
 */
export async function createProjectsOp(ctx: UserContext, rawItems: CreateProjectItem[], workspaceId: string) {
  const items = rawItems.map((item) => projectContract.normalizeBody(item));
  const user = ctx.var.user;
  const organization = ctx.var.organization;

  // Guarded resolution: rejects a workspace in a different organization than the request context,
  // keeping a new project's membership org-consistent with the workspace it is filed under.
  const resolvedWorkspaceId = await resolveProjectWorkspaceId(ctx, workspaceId);

  const slugAvailability = await checkSlugsAvailable(
    ctx,
    items.map((item) => item.slug),
    'project',
  );
  const { items: itemsToCreate, rejectionState } = filterWithRejection(items, (item) => slugAvailability.get(item.slug) === true, 'slug_exists');
  if (itemsToCreate.length === 0) return { data: [], ...rejectionState };

  const currentProjects = await countTenantEntityRows(ctx, { entityType: 'project' });
  assertTenantQuota(ctx, 'project', currentProjects, itemsToCreate.length);

  // One subject for the whole batch: every item is a project in this organization
  canCreateEntity(ctx, buildSubject('project', { organizationId: organization.id }));

  // One transaction for the rows, the handlers of `project.created` (the label module seeds primary labels) and the
  // creator's memberships: a failure in any of them leaves no project behind.
  const { projectRecords, createdMemberships } = await tenantContext(ctx, async (txCtx) => {
    const projectRecords = await insertProjects(txCtx, {
      projects: itemsToCreate.map((item) => ({
        entityType: 'project' as const,
        name: item.name,
        slug: item.slug,
        public: item.public,
        createdBy: user.id,
        tenantId: organization.tenantId,
        organizationId: organization.id,
      })),
    });

    await dispatchMutation(txCtx, 'project.created', { after: projectRecords });

    const createdMemberships = await insertMemberships(txCtx, {
      items: projectRecords.map((project) => ({
        userId: user.id,
        createdBy: user.id,
        role: 'admin' as const,
        entity: project,
        extraFields: { workspaceId: resolvedWorkspaceId },
      })),
    });

    return { projectRecords, createdMemberships };
  });

  log.info('Projects created', { count: projectRecords.length, ids: projectRecords.map((project) => project.id) });

  // The caller's next request reads the new memberships
  invalidateCache.user(user.id);

  const counts = buildZeroCounts('project', 'admin');
  const membershipByProjectId = new Map(createdMemberships.map((membership) => [membership.projectId, membership]));

  const projectsWithAudit = await withActorRefs(ctx, projectRecords, [userActorRef(user)]);

  const projectResponses = projectsWithAudit.map((project) => {
    const membership = membershipByProjectId.get(project.id)!;
    return {
      ...project,
      included: { membership: toMembershipBase(membership), counts: { ...counts, taskStatusCounts: defaultTaskStatusCounts } },
    };
  });

  return { data: projectResponses, ...rejectionState };
}
