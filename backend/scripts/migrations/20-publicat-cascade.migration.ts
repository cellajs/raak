import pc from 'picocolors';
import type { GenerateScript } from '../types';
import { logMigrationResult, upsertMigration } from './helpers/drizzle-utils';

/**
 * publicAt cascade: denormalizes a project's `public_at` onto its child products so row-local
 * public read (`publicRead('publicSelf')`) reflects "public because the parent project is public".
 *
 * Public read is now row-local (permission-actor migration removed `publicParent`): a row is
 * publicly readable only when its OWN `public_at` is set. Tasks and attachments declare
 * `publicRead('publicSelf')` and are served under a public project (public share links), so their
 * `public_at` must mirror the project's. This keeps single-row reads, collection SQL and CDC in
 * agreement without a read-time join.
 *
 * Three parts:
 *   1. one-time BACKFILL of existing rows,
 *   2. an AFTER UPDATE trigger on `projects` that cascades (un)publish to children,
 *   3. a BEFORE INSERT trigger on each child that inherits the parent's `public_at` at creation
 *      (covers rows created after the project went public, across every insert path).
 *
 * Children: tasks, attachments — the product entities with `publicRead('publicSelf')` whose home
 * channel is the project. Extend both lists here if another public product entity is added.
 */
async function run() {
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

  const cascadeUpdates = children
    .map(
      (child) => `  UPDATE ${child}
    SET public_at = NEW.public_at
    WHERE project_id = NEW.id AND public_at IS DISTINCT FROM NEW.public_at;`,
    )
    .join('\n');

  const insertTriggers = children
    .map(
      (child) => `DROP TRIGGER IF EXISTS trg_inherit_public_at_${child} ON ${child};
--> statement-breakpoint
CREATE TRIGGER trg_inherit_public_at_${child}
  BEFORE INSERT ON ${child}
  FOR EACH ROW
  EXECUTE FUNCTION inherit_public_at_from_project();`,
    )
    .join('\n--> statement-breakpoint\n');

  const migrationSql = `-- publicAt cascade: project.public_at → child products (tasks, attachments)
-- Row-local public read requires each child to carry its own public_at, mirroring its project.

-- 1. One-time backfill of existing rows.
${backfill}
--> statement-breakpoint

-- 2. Cascade on project (un)publish. Fires only when public_at actually changes; rewrites only
--    children whose value differs (cheap, idempotent).
CREATE OR REPLACE FUNCTION cascade_public_at_from_project() RETURNS trigger AS $$
BEGIN
  IF NEW.public_at IS DISTINCT FROM OLD.public_at THEN
${cascadeUpdates}
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_cascade_public_at_from_project ON projects;
--> statement-breakpoint
CREATE TRIGGER trg_cascade_public_at_from_project
  AFTER UPDATE OF public_at ON projects
  FOR EACH ROW
  EXECUTE FUNCTION cascade_public_at_from_project();
--> statement-breakpoint

-- 3. Inherit the parent project's public_at on child insert, unless the caller set it explicitly.
CREATE OR REPLACE FUNCTION inherit_public_at_from_project() RETURNS trigger AS $$
BEGIN
  IF NEW.public_at IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT p.public_at INTO NEW.public_at FROM projects p WHERE p.id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
${insertTriggers}
`;

  const result = upsertMigration('publicat_cascade', migrationSql);
  logMigrationResult(result, 'publicAt cascade');

  console.info('');
  console.info(`  ${pc.bold(pc.greenBright('publicAt cascade:'))} projects → ${children.join(', ')}`);
  console.info('');
}

export const generateConfig: GenerateScript = {
  name: 'publicAt cascade',
  type: 'migration',
  run,
};
