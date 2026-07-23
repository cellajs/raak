import { eq, isNotNull, sql } from 'drizzle-orm';
import { mediaBlockTypes } from 'shared/blocknote';
import type { DescriptionBlock } from 'shared/utils/derive-description-core';
import { seedDb } from '#/db/db';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import { tasksTable } from '#/modules/task/task-db';
import { validUuidSchema } from '#/schemas';

/**
 * One-off backfill: stamp `attachmentId` props onto description media blocks and
 * re-derive each task's `attachments` host array from the stamped blocks.
 *
 * Run once per environment right after deploying the task-attachments embedding
 * migration: `pnpm --filter backend exec tsx scripts/backfill-attachment-refs.ts`.
 * Idempotent: blocks that already carry an attachmentId are left untouched.
 *
 * Resolution rules mirror the historical upload panel behavior:
 * private-attachment blocks store the attachment id in `url` (bare UUID);
 * public-attachment blocks store the attachment's originalKey in `url`.
 */
const db = seedDb;

const isUuid = (value: string) => validUuidSchema.safeParse(value).success;

const stampBlocks = (blocks: DescriptionBlock[], keyToId: Map<string, string>): { changed: boolean; ids: string[] } => {
  let changed = false;
  const ids = new Set<string>();

  const walk = (items: DescriptionBlock[]) => {
    for (const block of items) {
      if (mediaBlockTypes.has(block.type) && block.props) {
        const existing = block.props.attachmentId;
        if (typeof existing === 'string' && existing.length > 0) {
          ids.add(existing);
        } else {
          const url = block.props.url;
          if (typeof url === 'string' && url.length > 0) {
            const resolved = isUuid(url) ? url : keyToId.get(url);
            if (resolved) {
              block.props.attachmentId = resolved;
              ids.add(resolved);
              changed = true;
            }
          }
        }
      }
      if (block.children?.length) walk(block.children);
    }
  };
  walk(blocks);
  return { changed, ids: [...ids] };
};

const run = async () => {
  const attachments = await db
    .select({ id: attachmentsTable.id, organizationId: attachmentsTable.organizationId, originalKey: attachmentsTable.originalKey })
    .from(attachmentsTable);

  const keysByOrg = new Map<string, Map<string, string>>();
  for (const att of attachments) {
    const orgKeys = keysByOrg.get(att.organizationId) ?? new Map<string, string>();
    orgKeys.set(att.originalKey, att.id);
    keysByOrg.set(att.organizationId, orgKeys);
  }

  const tasks = await db
    .select({ id: tasksTable.id, organizationId: tasksTable.organizationId, description: tasksTable.description })
    .from(tasksTable)
    .where(isNotNull(tasksTable.description));

  let updated = 0;

  for (const task of tasks) {
    if (!task.description) continue;
    let blocks: DescriptionBlock[];
    try {
      blocks = JSON.parse(task.description);
    } catch {
      continue;
    }
    if (!Array.isArray(blocks) || blocks.length === 0) continue;

    const keyToId = keysByOrg.get(task.organizationId) ?? new Map<string, string>();
    const { changed, ids } = stampBlocks(blocks, keyToId);
    if (!changed) continue;

    await db
      .update(tasksTable)
      .set({
        description: JSON.stringify(blocks),
        attachments: ids.filter(isUuid),
        stx: sql`stx - 'changedFields'`,
      })
      .where(eq(tasksTable.id, task.id));
    updated++;
  }

  console.info(`Backfill complete: ${updated} tasks updated (of ${tasks.length} with descriptions).`);
  process.exit(0);
};

run().catch((err) => {
  console.error('Backfill failed', err);
  process.exit(1);
});
