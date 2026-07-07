import { registerModule } from 'shared/module-registry';
import { uuidv7 } from 'uuidv7';
import { registerYjsMaterializer } from '#/core/yjs-materializers';
import { updateTaskOp } from '#/modules/task/operations/update-task';

registerModule({
  name: 'tasks',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing tasks, which represent actionable items of work within a project. Tasks
    support labeling, assignment, and status tracking, and are strictly scoped to their parent project.`,
});

// Yjs relay materialization: persist a collab session's description through the standard
// update op. Empty fieldTimestamps → the stx pipeline stamps a server HLC for `description`;
// the backend re-derives summary/counts/keywords authoritatively.
registerYjsMaterializer('task', async (ctx, { entityId, description }) => {
  await updateTaskOp(
    ctx,
    entityId,
    { ops: { description }, stx: { mutationId: uuidv7(), sourceId: 'yjs-relay', fieldTimestamps: {} } },
    { fullResponse: false },
  );
});
