/**
 * Projects whose `public_at` changed between the index-aligned before/after rows of a
 * `project.updated` mutation, paired with the new value to cascade onto their children. Shared by
 * the task and attachment modules, which each rewrite their own child table.
 */
export function republishedProjects(
  before: Record<string, unknown>[],
  after: Record<string, unknown>[],
): { id: string; publicAt: string | null }[] {
  const changed: { id: string; publicAt: string | null }[] = [];
  for (const [index, project] of after.entries()) {
    const publicAt = (project.publicAt ?? null) as string | null;
    if (publicAt !== ((before[index]?.publicAt ?? null) as string | null)) {
      changed.push({ id: project.id as string, publicAt });
    }
  }
  return changed;
}
