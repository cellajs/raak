import { and, eq, sql } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';
import { republishedProjects } from '#/db/utils/cascade-public-at';
import { defineBackendModule } from '#/lib/module';
import { updateTaskOp } from '#/modules/task/operations/update-task';
import { tasksTable } from '#/modules/task/task-db';
import { getIsoDate } from '#/utils/iso-date';

defineBackendModule({
  name: 'tasks',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing tasks, which represent actionable items of work within a project. Tasks
    support labeling, assignment, and status tracking, and are strictly scoped to their parent project.`,
  entity: 'task',
  // Yjs relay materialization: persist a collab session's description through the standard
  // update op as a trusted server write. serverOrigin routes through resolveServerUpdateOps,
  // which stamps a fresh server HLC for `description` and attributes it to the server sourceId;
  // the passed stx is unused on that path. The backend re-derives summary/counts/keywords.
  yjsMaterializer: async (ctx, { entityId, description }) => {
    await updateTaskOp(
      ctx,
      entityId,
      { ops: { description }, stx: { mutationId: uuidv7(), sourceId: 'yjs-relay', fieldTimestamps: {} } },
      { fullResponse: false, serverOrigin: true },
    );
  },
  onMutation: {
    // Cascade a project's public_at change onto its child tasks (row-local public read). Server-origin
    // write (stx minus changedFields) so the change syncs, unlike the former DB trigger; runs inside
    // updateProjectOp's transaction (dispatched with txCtx) so publish and cascade commit together.
    'project.updated': async (ctx, { before = [], after = [] }) => {
      const updatedAt = getIsoDate();
      const updatedBy = ctx.var.user.id;
      for (const { id, publicAt } of republishedProjects(before, after)) {
        await ctx.var.db
          .update(tasksTable)
          .set({ publicAt, updatedAt, updatedBy, stx: sql`stx - 'changedFields'` })
          .where(and(eq(tasksTable.projectId, id), sql`${tasksTable.publicAt} IS DISTINCT FROM ${publicAt}`));
      }
    },
  },
});
