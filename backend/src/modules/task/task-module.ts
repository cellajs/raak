import { registerModule } from 'shared/module-registry';
import { uuidv7 } from 'uuidv7';
import { updateTaskOp } from '#/modules/task/operations/update-task';
import { registerYjsMaterializer } from '#/modules/yjs/yjs-materializers';

registerModule({
  name: 'tasks',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing tasks, which represent actionable items of work within a project. Tasks
    support labeling, assignment, and status tracking, and are strictly scoped to their parent project.`,
});

// Yjs relay materialization: persist a collab session's description through the standard
// update op as a trusted server write. serverOrigin routes through resolveServerUpdateOps,
// which stamps a fresh server HLC for `description` and attributes it to the server sourceId;
// the passed stx is unused on that path. The backend re-derives summary/counts/keywords.
registerYjsMaterializer('task', async (ctx, { entityId, description }) => {
  await updateTaskOp(
    ctx,
    entityId,
    { ops: { description }, stx: { mutationId: uuidv7(), sourceId: 'yjs-relay', fieldTimestamps: {} } },
    { fullResponse: false, serverOrigin: true },
  );
});
