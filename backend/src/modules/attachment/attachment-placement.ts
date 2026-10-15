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

// fork: raak homes seeded attachments at its projects, mirroring the project's publicity onto them
/** One home per seeded project, mirroring the project's publicity onto its attachments. */
export const seedAttachmentPlacements = async (db: DB, organizations: { id: string; tenantId: string }[]): Promise<AttachmentSeedPlacement[]> => {
  const organizationIds = new Set(organizations.map((org) => org.id));
  const projects = await db
    .select({
      id: projectsTable.id,
      organizationId: projectsTable.organizationId,
      tenantId: projectsTable.tenantId,
      publicAt: projectsTable.publicAt,
    })
    .from(projectsTable)
    // The seed deals assets over an organization's homes in this order, so it has to be stable across runs.
    .orderBy(projectsTable.id);

  return projects
    .filter((project) => organizationIds.has(project.organizationId))
    .map((project) => ({
      organizationId: project.organizationId,
      tenantId: project.tenantId,
      placement: { projectId: project.id, publicAt: project.publicAt },
    }));
};
