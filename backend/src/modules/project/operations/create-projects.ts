import type { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { buildZeroCounts } from '#/modules/entities/helpers/build-zero-counts';
import { checkSlugsAvailable } from '#/modules/entities/helpers/check-slug';
import { getOrgEntityCount } from '#/modules/entities/helpers/get-entity-counts';
import { insertMemberships } from '#/modules/memberships/helpers/membership-helpers';
import { toMembershipBase } from '#/modules/memberships/helpers/select';
import { insertProjects } from '#/modules/project/project-queries';
import type { projectCreateBodySchema } from '#/modules/project/project-schema';
import { withAuditUsers } from '#/modules/user/helpers/audit-user';
import { getValidContextEntity } from '#/permissions';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { logEvent } from '#/utils/logger';
import { filterWithRejection, takeWithRestriction } from '#/utils/rejection-utils';

const defaultTaskStatusCounts = {
  accepted: 0,
  reviewed: 0,
  delivered: 0,
  finished: 0,
  started: 0,
  unstarted: 0,
  iced: 0,
};

type CreateProjectItem = z.infer<typeof projectCreateBodySchema>[number];

export async function createProjectsOp(ctx: AuthContext, items: CreateProjectItem[], workspaceId: string) {
  const db = ctx.var.db;
  const user = ctx.var.user;
  const organization = ctx.var.organization;

  const { entity: workspace } = await getValidContextEntity(ctx, workspaceId, 'workspace', 'read');

  // Check if adding is allowed based on the organization's restrictions
  const currentProjectsCount = await getOrgEntityCount(ctx, organization.id, 'project');
  const projectRestrictions = ctx.var.tenant.restrictions.quotas.project;

  const availableSlots = projectRestrictions === 0 ? items.length : projectRestrictions - currentProjectsCount;

  // Check slug availability in database
  const slugs = items.map((item) => item.slug);
  const slugAvailability = slugs.length > 0 ? await checkSlugsAvailable(ctx, slugs, 'project') : new Map();

  // Filter by slug availability, track rejections
  const slugFiltered = filterWithRejection(items, (item) => slugAvailability.get(item.slug) === true, 'slug_exists');

  // Enforce restriction (0 means unlimited)
  const restrictionFiltered =
    projectRestrictions === 0
      ? { items: slugFiltered.items, rejectionState: slugFiltered.rejectionState }
      : takeWithRestriction(slugFiltered.items, availableSlots, 'restrict_by_org', slugFiltered.rejectionState);

  // Final items to create and rejection state
  const itemsToCreate = restrictionFiltered.items;
  const rejectionState = restrictionFiltered.rejectionState;

  // If nothing to create, return early
  if (itemsToCreate.length === 0) {
    return { data: [] as never[], ...rejectionState };
  }

  // Permission check (same for all items since entityType + org is the same)
  canCreateEntity(ctx, buildSubject('project', { organizationId: organization.id }));

  // Insert projects
  const projectRecords = await insertProjects(ctx, {
    projects: itemsToCreate.map((item) => ({
      entityType: 'project' as const,
      name: item.name,
      slug: item.slug,
      publicAt: item.publicAt,
      createdBy: user.id,
      tenantId: organization.tenantId,
      organizationId: organization.id,
    })),
  });

  const projectIds = projectRecords.map((p) => p.id);

  logEvent(ctx, 'info', 'Projects created', { count: projectRecords.length, ids: projectIds });

  // Insert memberships for each project
  const membershipInserts = projectRecords.map((project) => ({
    userId: user.id,
    createdBy: user.id,
    role: 'admin' as const,
    entity: { ...project, tenantId: organization.tenantId },
    extraFields: { workspaceId: workspace.id },
  }));

  const createdMemberships = await insertMemberships({ var: { db } }, { items: membershipInserts, logCtx: ctx });

  // Invalidate membership cache so subsequent requests see the new membership
  invalidateCache.user(user.id);

  // Build counts for response
  const counts = buildZeroCounts('project');
  // Map memberships by projectId
  const membershipByProjectId = new Map(createdMemberships.map((m) => [m.projectId, m]));

  const projectsWithAudit = await withAuditUsers(ctx, projectRecords, user);

  const projectResponses = projectsWithAudit.map((project) => {
    const membership = membershipByProjectId.get(project.id)!;
    return {
      ...project,
      included: {
        membership: toMembershipBase(membership),
        counts: { ...counts, taskStatusCounts: defaultTaskStatusCounts },
      },
    };
  });

  return { data: projectResponses, ...rejectionState };
}
