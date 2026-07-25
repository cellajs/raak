import { registerModule } from 'shared/module-registry';
import { uuidv7 } from 'uuidv7';
import { updateLabelOp } from '#/modules/label/operations/update-label';
import { registerYjsMaterializer } from '#/modules/yjs/yjs-materializers';

registerModule({
  name: 'labels',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing labels, which are lightweight, user defined tags assigned to tasks.
    Labels help categorize and filter tasks (for example client, api, or backend). They exist at the
    project level and are available to all members of the project.`,
});

// Yjs relay materialization for epic documentation: persist a collab session's description
// through the standard update op as a trusted server write. serverOrigin routes through
// resolveServerUpdateOps (fresh server HLC, server sourceId); the op re-derives keywords and
// rejects description writes on non-epic labels.
registerYjsMaterializer('label', async (ctx, { entityId, description }) => {
  await updateLabelOp(
    ctx,
    entityId,
    { ops: { description }, stx: { mutationId: uuidv7(), sourceId: 'yjs-relay', fieldTimestamps: {} } },
    { serverOrigin: true },
  );
});
