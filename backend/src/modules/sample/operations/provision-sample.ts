import { nanoid } from 'nanoid';
import { buildSubject, hierarchy } from 'shared';
import { labelSlug } from 'shared/config/labels-config';
import { defaultOrder, orderGap } from 'shared/utils/display-order';
import { generateId } from 'shared/utils/entity-id';
import slugify from 'slugify';
import type { ActorContext, UserContext } from '#/core/context';
import { createServerStx } from '#/core/stx/create-server-stx';
import { tenantContext } from '#/db/tenant-context';
import { dispatchMutation } from '#/lib/mutation-bus';
import { invalidateCache } from '#/middlewares/guard/invalidate-cache';
import { countTenantEntityRows } from '#/modules/entities/entities-queries';
import { checkSlugsAvailable } from '#/modules/entities/operations/check-slug';
import { heatRank, heatWeights } from '#/modules/label/helpers/label-heat';
import type { InsertLabelModel } from '#/modules/label/label-db';
import { findLivePrimaryLabels, insertLabels } from '#/modules/label/label-queries';
import { insertMemberships } from '#/modules/memberships/operations/insert-memberships';
import { resolveProjectWorkspaceId } from '#/modules/project/operations/project-workspace-membership';
import type { ProjectModel } from '#/modules/project/project-db';
import { insertProjects } from '#/modules/project/project-queries';
import { sampleDescription } from '#/modules/sample/helpers/sample-description';
import { sampleContent, sampleMoment, samplePersonId, samplePersonIds, sampleStatus } from '#/modules/sample/sample-content';
import { findSampleProjects, insertSamplePeople, lockOrganizationSample } from '#/modules/sample/sample-queries';
import { deriveDescriptionProps } from '#/modules/task/helpers/description';
import type { InsertTaskModel } from '#/modules/task/task-db';
import { insertTasks } from '#/modules/task/task-queries';
import { insertWithinTenantQuota } from '#/modules/tenants/quota-lock';
import { assertTenantQuota } from '#/modules/tenants/tenant-restrictions';
import { canCreateEntity } from '#/permissions/can-create';
import { log } from '#/utils/logger';

/** A free slug per sample project: its name and the organization's handle, with a short suffix once that is taken. */
const sampleProjectSlugs = async (ctx: ActorContext, organizationSlug: string) => {
  const bases = sampleContent.projects.map(({ name }) => slugify(`${name} ${organizationSlug}`, { lower: true, strict: true }));
  const available = await checkSlugsAvailable(ctx, bases, 'project');
  return bases.map((base) => (available.get(base) ? base : `${base}-${nanoid(6).toLowerCase()}`));
};

/** Writes the sample projects with their labels and tasks, as the sample people made them, and returns the projects. */
const createSampleProjects = async (ctx: UserContext, txCtx: ActorContext): Promise<ProjectModel[]> => {
  const { organization } = ctx.var;
  const scope = { tenantId: organization.tenantId, organizationId: organization.id };

  const projectCount = await countTenantEntityRows(txCtx, { entityType: 'project' });
  assertTenantQuota(ctx, 'project', projectCount, sampleContent.projects.length);

  const slugs = await sampleProjectSlugs(txCtx, organization.slug);
  const projects = await insertProjects(txCtx, {
    projects: sampleContent.projects.map((project, index) => ({
      ...scope,
      entityType: 'project' as const,
      name: project.name,
      slug: slugs[index],
      public: false,
      createdAt: sampleMoment(project.age),
      createdBy: samplePersonId(project.by),
    })),
  });
  // The label module gives each project the organization's task types, inside this transaction
  await dispatchMutation(txCtx, 'project.created', { after: projects });
  const projectIdOf = (key: string) => {
    const slug = slugs[sampleContent.projects.findIndex((project) => project.key === key)];
    const project = projects.find((candidate) => candidate.slug === slug);
    if (!project) throw new Error(`The sample project ${key} was not inserted`);
    return project.id;
  };

  const labelRows = sampleContent.projects.flatMap((project) =>
    project.labels.map(
      (name): InsertLabelModel => ({
        ...scope,
        entityType: 'label',
        name,
        slug: labelSlug(name),
        mode: 'secondary',
        displayOrder: heatRank(heatWeights.created),
        projectId: projectIdOf(project.key),
        createdAt: sampleMoment(project.age),
        createdBy: samplePersonId(project.by),
        stx: createServerStx(),
      }),
    ),
  );
  const labels = await insertWithinTenantQuota(txCtx, 'label', () => insertLabels(txCtx, { labels: labelRows }));
  await dispatchMutation(txCtx, 'label.created', { after: labels });

  const types = await findLivePrimaryLabels(txCtx, { projectIds: projects.map(({ id }) => id) });
  const typeId = (projectId: string, slug: string) => {
    const projectTypes = types.filter((type) => type.projectId === projectId).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    return (projectTypes.find((type) => type.slug === slug) ?? projectTypes[0]).id;
  };
  const labelId = (projectId: string, name: string) => labels.find((label) => label.projectId === projectId && label.name === name)?.id;

  const taskRows = sampleContent.tasks.map((task, index): InsertTaskModel => {
    const projectId = projectIdOf(task.project);
    const description = sampleDescription(task);
    const createdAt = sampleMoment(task.age);
    return {
      ...scope,
      ...deriveDescriptionProps(description),
      id: generateId(),
      entityType: 'task',
      name: '',
      description,
      projectId,
      primaryLabelId: typeId(projectId, task.type),
      labels: task.labels.flatMap((name) => labelId(projectId, name) ?? []),
      assignedTo: task.assigned.map(samplePersonId),
      status: sampleStatus(task.status),
      statusChangedAt: task.statusAge ? sampleMoment(task.statusAge) : createdAt,
      // The board lists the highest first, so the dataset's order is the board's
      displayOrder: defaultOrder + (sampleContent.tasks.length - index) * orderGap,
      public: false,
      createdAt,
      createdBy: samplePersonId(task.by),
      stx: createServerStx(),
    };
  });
  // One insert in dataset order: the numbering trigger counts the rows in it, so an organization without tasks gets #1 up
  const tasks = await insertWithinTenantQuota(txCtx, 'task', () => insertTasks(txCtx, { tasks: taskRows }));
  await dispatchMutation(txCtx, 'task.created', { after: tasks });

  return projects;
};

/**
 * Gives the caller the organization's sample, creating it first when the organization has none: two projects with their
 * labels and tasks as the sample people wrote them, the sample people as members. The caller who creates it becomes its
 * admin, a later caller a member, so each member decides whether the sample is on their board. The caller's memberships
 * are filed under `workspaceId` when given, else under their first workspace.
 * @returns The sample's project ids, and `created` when this request wrote them.
 * @throws AppError 403 `restrict_by_app` past the tenant's project, label or task quota.
 */
export async function provisionSampleOp(ctx: UserContext, { workspaceId }: { workspaceId?: string }) {
  const { user, organization } = ctx.var;
  canCreateEntity(ctx, buildSubject('project', { organizationId: organization.id }));

  const callerWorkspaceId = workspaceId ? await resolveProjectWorkspaceId(ctx, workspaceId) : undefined;
  const filing = callerWorkspaceId ? { workspaceId: callerWorkspaceId } : undefined;
  await insertSamplePeople(ctx);

  const { projects, created } = await tenantContext(ctx, async (txCtx) => {
    await lockOrganizationSample(txCtx, { organizationId: organization.id });

    const existing = await findSampleProjects(txCtx, { organizationId: organization.id });
    if (existing.length) {
      const held = new Set(ctx.var.memberships.flatMap((membership) => (membership.channelType === 'project' ? [membership.channelId] : [])));
      await insertMemberships(txCtx, {
        items: existing
          .filter((project) => !held.has(project.id))
          .map((project) => ({ userId: user.id, createdBy: user.id, role: 'member' as const, entity: project, extraFields: filing })),
      });
      return { projects: existing, created: false };
    }

    const projects = await createSampleProjects(ctx, txCtx);
    const role = hierarchy.getMostPrivilegedRole('project');
    await insertMemberships(txCtx, {
      items: projects.flatMap((project) => [
        { userId: user.id, createdBy: user.id, role, entity: project, extraFields: filing },
        // No workspace: the sample people never open a menu
        ...samplePersonIds.map((userId) => ({ userId, createdBy: user.id, role: 'member' as const, entity: project, extraFields: {} })),
      ]),
    });
    return { projects, created: true };
  });

  invalidateCache.user(user.id);
  log.info(created ? 'Sample created' : 'Sample joined', { organizationId: organization.id, projectIds: projects.map(({ id }) => id) });

  return { created, projectIds: projects.map(({ id }) => id) };
}
