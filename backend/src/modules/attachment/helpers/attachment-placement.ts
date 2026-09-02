import { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import type { DB } from '#/db/db';
import { tenantRead } from '#/db/tenant-context';
import type { attachmentsTable } from '#/modules/attachment/attachment-db';
import { projectsTable } from '#/modules/project/project-db';
import { findProjectById } from '#/modules/task/task-queries';
import { validIdSchema } from '#/schemas';

/**
 * Attachment placement seam, filled for raak: attachments are homed on a project (the parent
 * channel in raak's hierarchy), so every create-body item must name the project, the resolved
 * row carries it as its home column and inherits the project's public-read flag, list reads
 * compile against the project column and narrow to one project, and the seed homes one batch
 * per project. The cella-owned schema, list and create ops and the seed call through this file,
 * so the app-specific axis stays local to it.
 */
export const attachmentPlacementFieldsSchema = {
  projectId: validIdSchema,
};

export type AttachmentPlacementInput = { projectId: string } & Record<string, unknown>;

/** The project home column plus the project's public-read flag, inherited server-side. */
export type ResolvedAttachmentPlacement = { projectId: string; publicAt: string | null };

const placementInputSchema = z.object({ projectId: validIdSchema });

/** Per-item create-body validation; the schema already requires exactly one home id, so nothing is ambiguous. */
export const validateAttachmentPlacement = (
  item: AttachmentPlacementInput,
): { path: (string | number)[]; message: string } | null => {
  const parsed = placementInputSchema.safeParse(item);
  if (parsed.success) return null;
  return { path: ['projectId'], message: 'projectId is required' };
};

/** Resolves a project of the current organization by id, 404 when absent. */
const findOrganizationProject = async (ctx: AuthContext, projectId: string) => {
  const project = await tenantRead(ctx, (readCtx) => findProjectById(readCtx, { projectId }));
  if (!project) throw new AppError(404, 'not_found', 'warn', { entityType: 'project' });
  return project;
};

/**
 * The project id is stamped as the home column and the row inherits the project's `publicAt`
 * server-side (a public project publishes its attachments). Membership on that project is
 * enforced by the create op's `canCreateEntity` check, which reads the hierarchy ancestors off
 * the resolved row.
 */
export const resolveAttachmentPlacement = async (
  ctx: AuthContext,
  input: AttachmentPlacementInput,
): Promise<ResolvedAttachmentPlacement> => {
  const project = await findOrganizationProject(ctx, input.projectId);
  return { projectId: project.id, publicAt: project.publicAt };
};

/** Column holding a row's home channel id: list reads compile the caller's grant scope against it. */
export const attachmentHomeColumnKey = 'projectId' satisfies keyof typeof attachmentsTable.$inferSelect;

/**
 * Home channel a list or delta read narrows to, from the `channelId` query param; undefined (or
 * the organization itself) reads org-wide. A requested project must exist in the organization
 * (404 otherwise); membership on it is not required here, because the collection read filter
 * narrows a non-member to the rows the row-conditional policy grants (own rows).
 */
export const resolveAttachmentHomeScope = async (
  ctx: AuthContext,
  channelId: string | undefined,
): Promise<string | undefined> => {
  if (!channelId || channelId === ctx.var.organization.id) return undefined;
  const project = await findOrganizationProject(ctx, channelId);
  return project.id;
};

/** One seed batch: the organization it belongs to and the ancestor columns its rows carry. */
export interface AttachmentSeedPlacement {
  organizationId: string;
  tenantId: string;
  placement: ResolvedAttachmentPlacement;
}

/** One batch per seeded project, mirroring the project's publicity onto its attachments. */
export const seedAttachmentPlacements = async (
  db: DB,
  organizations: { id: string; tenantId: string }[],
): Promise<AttachmentSeedPlacement[]> => {
  const organizationIds = new Set(organizations.map((org) => org.id));
  const projects = await db
    .select({
      id: projectsTable.id,
      organizationId: projectsTable.organizationId,
      tenantId: projectsTable.tenantId,
      publicAt: projectsTable.publicAt,
    })
    .from(projectsTable);

  return projects
    .filter((project) => organizationIds.has(project.organizationId))
    .map((project) => ({
      organizationId: project.organizationId,
      tenantId: project.tenantId,
      placement: { projectId: project.id, publicAt: project.publicAt },
    }));
};
