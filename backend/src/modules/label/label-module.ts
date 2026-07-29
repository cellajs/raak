import type { PrimaryLabelDefinition } from 'shared';
import { uuidv7 } from 'uuidv7';
import { tenantContext } from '#/db/tenant-context';
import { defineBackendModule } from '#/lib/module';
import { propagateSetupConfigLabels } from '#/modules/label/helpers/primary-labels';
import { updateLabelOp } from '#/modules/label/operations/update-label';

defineBackendModule({
  name: 'labels',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing labels, which are lightweight, user defined tags assigned to tasks.
    Labels help categorize and filter tasks (for example client, api, or backend). They exist at the
    project level and are available to all members of the project.`,
  entity: 'label',
  // Yjs relay materialization for epic documentation: persist a collab session's description
  // through the standard update op as a trusted server write. serverOrigin routes through
  // resolveServerUpdateOps (fresh server HLC, server sourceId); the op re-derives keywords and
  // rejects description writes on non-epic labels.
  yjsMaterializer: async (ctx, { entityId, description }) => {
    await updateLabelOp(
      ctx,
      entityId,
      { ops: { description }, stx: { mutationId: uuidv7(), sourceId: 'yjs-relay', fieldTimestamps: {} } },
      { serverOrigin: true },
    );
  },
  onMutation: {
    // Fan edited primary-label definitions out to still-tracked rows across the org's projects,
    // matched by slug. Only fires when the update body carried primaryLabels.
    'organization.updated': async (ctx, { after, input }) => {
      const primaryLabels = (input?.setupConfig as { primaryLabels?: PrimaryLabelDefinition[] } | undefined)
        ?.primaryLabels;
      if (!primaryLabels || !after) return;
      await tenantContext(ctx, (txCtx) =>
        propagateSetupConfigLabels(txCtx, {
          entries: primaryLabels,
          organizationId: after.id as string,
          updatedBy: ctx.var.user.id,
        }),
      );
    },
  },
});
