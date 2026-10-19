import { asc, eq, gt } from 'drizzle-orm';
import { getAdminDb } from '#/db/db';
import { labelsTable } from '#/modules/label/label-db';
import { deriveDescriptionProps } from '#/modules/task/helpers/description';
import { tasksTable } from '#/modules/task/task-db';
import { extractKeywordsFromBlocks } from '#/utils/extract-keywords';

/**
 * Rewrites task and label keywords from their descriptions. The word pattern dropped letters
 * outside ASCII until 2026-10-19 ("patiënt" was stored as "pati nt"), so rows written before carry
 * truncated words. Idempotent: a row whose keywords already match is left alone. Every rewrite is
 * an ordinary UPDATE, so CDC fans it out as a `keywords` change; run it in a quiet moment.
 */
const db = getAdminDb('keywords rederive');
const batchSize = 500;

type Row = { id: string; description: string | null; keywords: string };

const rederive = async (
  name: string,
  readAfter: (afterId: string | null) => Promise<Row[]>,
  derive: (description: string | null) => string,
  write: (id: string, keywords: string) => Promise<unknown>,
) => {
  let afterId: string | null = null;
  let seen = 0;
  let rewritten = 0;
  for (;;) {
    const rows = await readAfter(afterId);
    if (!rows.length) break;
    for (const row of rows) {
      const keywords = derive(row.description);
      if (keywords === row.keywords) continue;
      await write(row.id, keywords);
      rewritten++;
    }
    seen += rows.length;
    afterId = rows[rows.length - 1].id;
  }
  console.info(`${name}: ${rewritten} of ${seen} rows rewritten`);
};

await rederive(
  'tasks',
  (afterId) =>
    db
      .select({ id: tasksTable.id, description: tasksTable.description, keywords: tasksTable.keywords })
      .from(tasksTable)
      .where(afterId ? gt(tasksTable.id, afterId) : undefined)
      .orderBy(asc(tasksTable.id))
      .limit(batchSize),
  (description) => deriveDescriptionProps(description).keywords,
  (id, keywords) => db.update(tasksTable).set({ keywords }).where(eq(tasksTable.id, id)),
);

await rederive(
  'labels',
  (afterId) =>
    db
      .select({ id: labelsTable.id, description: labelsTable.description, keywords: labelsTable.keywords })
      .from(labelsTable)
      .where(afterId ? gt(labelsTable.id, afterId) : undefined)
      .orderBy(asc(labelsTable.id))
      .limit(batchSize),
  (description) => (description ? extractKeywordsFromBlocks(description) : ''),
  (id, keywords) => db.update(labelsTable).set({ keywords }).where(eq(labelsTable.id, id)),
);

process.exit(0);
