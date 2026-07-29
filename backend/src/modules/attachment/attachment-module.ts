import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { republishedProjects } from '#/db/utils/cascade-public-at';
import { defineBackendModule } from '#/lib/module';
import { attachmentsTable } from '#/modules/attachment/attachment-db';
import { getIsoDate } from '#/utils/iso-date';

defineBackendModule({
  name: 'attachments',
  owner: 'cella',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing file based attachments (such as images, PDFs, and documents) linked to
    entities such as organizations or users. Files are uploaded directly by the client, while the API handles
    metadata registration, linking, access, and preview utilities.`,
  onMutation: {
    // Cascade a project's public_at change onto its child attachments (row-local public read).
    // Server-origin write so the change syncs; runs inside updateProjectOp's transaction.
    'project.updated': async (ctx, { before = [], after = [] }) => {
      const updatedAt = getIsoDate();
      const updatedBy = ctx.var.user.id;
      for (const { id, publicAt } of republishedProjects(before, after)) {
        await ctx.var.db
          .update(attachmentsTable)
          .set({ publicAt, updatedAt, updatedBy, stx: sql`stx - 'changedFields'` })
          .where(
            and(eq(attachmentsTable.projectId, id), sql`${attachmentsTable.publicAt} IS DISTINCT FROM ${publicAt}`),
          );
      }
    },
    // Lifecycle cascade: soft-delete a deleted task's attachments (host relation), reusing the
    // tasks' deletedAt/deletedBy. Runs inside the task-delete transaction (dispatched with txCtx).
    'task.deleted': async (ctx, { before = [] }) => {
      if (!before.length) return;
      const [{ deletedAt, deletedBy }] = before as { deletedAt: string; deletedBy: string }[];
      const taskIds = before.map((task) => task.id as string);
      await ctx.var.db
        .update(attachmentsTable)
        .set({ deletedAt, deletedBy, updatedAt: deletedAt, updatedBy: deletedBy })
        .where(
          and(
            inArray(attachmentsTable.taskId, taskIds),
            eq(attachmentsTable.organizationId, ctx.var.organizationId),
            isNull(attachmentsTable.deletedAt),
          ),
        );
    },
  },
});
