import type { SideEffectBlock, SideEffectProducer } from '../types';

/**
 * publicAt distribution is owned by the server runtime: a child inherits its project's publicAt at
 * create (the insert helpers), then it is row-local and independent (make public / make private per
 * row or batch). This migration drops the former trigger-based cascade and inherit, which the
 * runtime replaced. Once every environment has run it, this producer can be deleted.
 */
function run(): SideEffectBlock {
  const children = ['tasks', 'attachments'] as const;

  const dropInheritTriggers = children
    .map((child) => `DROP TRIGGER IF EXISTS trg_inherit_public_at_${child} ON ${child};`)
    .join('\n--> statement-breakpoint\n');

  const migrationSql = `-- publicAt distribution moved to the server runtime; drop the former triggers.
DROP TRIGGER IF EXISTS trg_cascade_public_at_from_project ON projects;
--> statement-breakpoint
DROP FUNCTION IF EXISTS cascade_public_at_from_project();
--> statement-breakpoint
${dropInheritTriggers}
--> statement-breakpoint
DROP FUNCTION IF EXISTS inherit_public_at_from_project();`;

  return {
    tag: 'publicat_cascade',
    title: 'drop the former publicAt cascade/inherit triggers (runtime owns publicAt)',
    sql: migrationSql,
    notes: [`Dropped trigger-based publicAt cascade/inherit for: ${children.join(', ')}`],
  };
}

export const sideEffect: SideEffectProducer = {
  name: 'publicAt distribution (runtime)',
  produce: run,
};
