import { and, eq, inArray, isNull } from 'drizzle-orm';
import { appConfig } from 'shared';
import type { DbOrTx } from '#/db/create-connection';
import { publishedRowsPredicate } from '#/db/utils/published-predicate';
import type { ModuleNotifications, NotificationSubjectRow } from '#/lib/module';
import type { MutationHandler } from '#/lib/mutation-bus';
import { deriveMentionsFor } from '#/modules/notification/operations/derive-mentions';
import { tasksTable } from '#/modules/task/task-db';

const liveTasks = (ids: string[]) =>
  and(inArray(tasksTable.id, ids), isNull(tasksTable.deletedAt), publishedRowsPredicate(tasksTable));

/**
 * Notification source for tasks: mentions in the description are the only recipients for now.
 * Assignees would need a notification type the cella vocabulary does not carry yet.
 */
export const taskNotifications: ModuleNotifications = {
  mentionable: true,
  loadRows: async (tx: DbOrTx, ids: string[]): Promise<NotificationSubjectRow[]> =>
    tx.select().from(tasksTable).where(liveTasks(ids)),
  writeMentions: async (tx: DbOrTx, id: string, mentions: string[]) => {
    await tx.update(tasksTable).set({ mentions }).where(eq(tasksTable.id, id));
  },
  loadPreview: async (tx: DbOrTx, subjectId: string) => {
    const [task] = await tx
      .select({ name: tasksTable.name, summary: tasksTable.summary })
      .from(tasksTable)
      .where(liveTasks([subjectId]))
      .limit(1);
    return task ? { title: task.name, body: task.summary } : null;
  },
  loadContextNames: async (tx: DbOrTx, ids: string[]) => {
    const rows = await tx.select({ id: tasksTable.id, name: tasksTable.name }).from(tasksTable).where(liveTasks(ids));
    return new Map(rows.map((row) => [row.id, row.name]));
  },
  resolveEmailLink: ({ subjectId }) => taskLink(subjectId),
};

/** The public task link resolver route picks the board (private, public or sign-in) per visitor. */
export const taskLink = (taskId: string) => `${appConfig.frontendUrl}/t/${taskId}`;

/**
 * Task descriptions are edited collaboratively and reach the row through Yjs materialization, a
 * server-origin write that cella's mention derivation skips (it assumes client writes carry the
 * intent and Yjs re-writes are echoes). In raak the Yjs document is the description's source of
 * truth, so the materialized body is the one to derive from: a mention edited away in the editor
 * is absent from that body and gets removed, never resurrected.
 */
export const deriveTaskMentionsOnMaterialize: MutationHandler = async (ctx, payload) => {
  if (!payload.serverOrigin) return;
  await deriveMentionsFor('task', taskNotifications)(ctx, { ...payload, serverOrigin: false });
};
