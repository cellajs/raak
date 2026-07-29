import type { SideEffectBlock, SideEffectProducer } from '../types';

/**
 * publicAt distribution: a child product's `public_at` mirrors its parent project's, so row-local
 * public read (`publicRead()`) reflects "public because the parent project is public".
 *
 * Public read is row-local: a row is publicly readable only when its OWN `public_at` is set. Tasks
 * and attachments declare `publicRead()` and are served under a public project (public share
 * links), so their `public_at` must mirror the project's, keeping single-row reads, collection SQL
 * and CDC in agreement without a read-time join.
 *
 * This distribution is owned by the server runtime: the mutation bus cascades a project's
 * `public_at` change onto its children (task/attachment `onMutation['project.updated']`), and the
 * insert helpers inherit it on child create (`inheritPublicAtFromProject`), so the cascaded writes
 * carry `stx` and sync. This migration backfills existing rows once and drops the former
 * trigger-based distribution.
 *
 * Children: tasks, attachments, the product entities with `publicRead()` whose home channel is the
 * project. Extend the list here if another public product entity is added.
 */
function run(): SideEffectBlock {
  const children = ['tasks', 'attachments'] as const;

  const backfill = children
    .map(
      (child) => `UPDATE ${child} c
SET public_at = p.public_at
FROM projects p
WHERE c.project_id = p.id
  AND c.public_at IS DISTINCT FROM p.public_at;`,
    )
    .join('\n--> statement-breakpoint\n');

  const dropInheritTriggers = children
    .map((child) => `DROP TRIGGER IF EXISTS trg_inherit_public_at_${child} ON ${child};`)
    .join('\n--> statement-breakpoint\n');

  const migrationSql = `-- publicAt distribution is owned by the server runtime (mutation bus + insert helpers).
-- Backfill existing rows once, then drop the former trigger-based cascade/inherit.

-- 1. One-time backfill of existing rows (idempotent).
${backfill}
--> statement-breakpoint

-- 2. Drop the former cascade + inherit triggers and their functions.
DROP TRIGGER IF EXISTS trg_cascade_public_at_from_project ON projects;
--> statement-breakpoint
DROP FUNCTION IF EXISTS cascade_public_at_from_project();
--> statement-breakpoint
${dropInheritTriggers}
--> statement-breakpoint
DROP FUNCTION IF EXISTS inherit_public_at_from_project();`;

  return {
    tag: 'publicat_cascade',
    title: 'publicAt distribution moved to runtime; backfill + drop former triggers',
    sql: migrationSql,
    notes: [`Dropped trigger-based cascade/inherit for: ${children.join(', ')}`],
  };
}

export const sideEffect: SideEffectProducer = {
  name: 'publicAt distribution (runtime)',
  produce: run,
};
