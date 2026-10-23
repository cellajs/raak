import type { DB } from '#/db/db';
// fork: seed batches home at raak's projects
import { projectsTable } from '#/modules/project/project-db';
import type { ResolvedPlacement } from '#/permissions/product-placement';

/** One seed batch: the organization it belongs to and the ancestor columns its rows carry. */
export interface AttachmentSeedPlacement {
  organizationId: string;
  tenantId: string;
  placement: ResolvedPlacement<'attachment'>;
}

// fork: one home per seeded project, mirroring the project's publicity onto its attachments
/**
 * Where the attachment seed homes its rows (app-owned): one batch per organization by default, its rows in the
 * organization itself. An app whose attachments live in a channel returns one batch per home channel, or an empty
 * list to skip attachment seeding altogether (e.g. when its dev bucket carries no `seed/` objects). Creates and
 * list reads place rows by the hierarchy alone, in `#/permissions/product-placement`.
 */
export const seedAttachmentPlacements = async (db: DB, organizations: { id: string; tenantId: string }[]): Promise<AttachmentSeedPlacement[]> => {
  const organizationIds = new Set(organizations.map((org) => org.id));
  const projects = await db
    .select({
      id: projectsTable.id,
      organizationId: projectsTable.organizationId,
      tenantId: projectsTable.tenantId,
      public: projectsTable.public,
    })
    .from(projectsTable)
    // The seed deals assets over an organization's homes in this order, so it has to be stable across runs.
    .orderBy(projectsTable.id);

  return projects
    .filter((project) => organizationIds.has(project.organizationId))
    .map((project) => ({
      organizationId: project.organizationId,
      tenantId: project.tenantId,
      placement: { projectId: project.id, public: project.public },
    }));
};
