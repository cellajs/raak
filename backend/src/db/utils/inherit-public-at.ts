import { inArray } from 'drizzle-orm';
import type { DbContext } from '#/core/context';
import { projectsTable } from '#/modules/project/project-db';

/** A child product row that inherits public visibility from its parent project. */
interface ProjectChildRow {
  projectId?: string | null;
  publicAt?: string | null;
}

/**
 * Stamp each row's `publicAt` from its parent project when unset, so a child is publicly readable
 * exactly when its project is ("public because the parent project is public"). This is the runtime
 * owner of what the former `inherit_public_at_from_project` BEFORE INSERT trigger did; call it from
 * every insert path for a public product entity homed under a project (tasks, attachments). One
 * batched lookup covers the distinct parent projects. Mutates the rows in place.
 */
export async function inheritPublicAtFromProject(ctx: DbContext, rows: ProjectChildRow[]): Promise<void> {
  const pending = rows.filter((row) => row.publicAt == null && row.projectId);
  if (!pending.length) return;

  const projectIds = [...new Set(pending.map((row) => row.projectId as string))];
  const projects = await ctx.var.db
    .select({ id: projectsTable.id, publicAt: projectsTable.publicAt })
    .from(projectsTable)
    .where(inArray(projectsTable.id, projectIds));

  const publicAtByProject = new Map(projects.map((project) => [project.id, project.publicAt]));
  for (const row of pending) row.publicAt = publicAtByProject.get(row.projectId as string) ?? null;
}
