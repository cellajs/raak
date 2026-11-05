import { tenantContext } from '#/db/tenant-context';
import { defineBackendModule } from '#/lib/module';
import { collectLabelHeat } from '#/modules/label/helpers/label-heat';
import { buildPrimaryLabelRows } from '#/modules/label/helpers/primary-labels';
import { labelHandlers } from '#/modules/label/label-handlers';
import { bumpLabelHeat, insertLabels, propagateSetupConfigLabels } from '#/modules/label/label-queries';
import { updateLabelOp } from '#/modules/label/operations/update-label';
import { withSetupConfigDefaults } from '#/modules/organization/helpers/select';

defineBackendModule({
  name: 'labels',
  owner: 'app',
  scope: ['frontend', 'backend'],
  routes: [{ path: '/:tenantId/:organizationId/labels', app: labelHandlers, phase: 'tenant' }],
  description: `Endpoints for managing labels, which are lightweight, user defined tags assigned to tasks.
    Labels help categorize and filter tasks (for example client, api, or backend). They exist at the
    project level and are available to all members of the project.`,
  productEntity: 'label',
  yjsMaterializer: updateLabelOp,
  onMutation: {
    'project.created': async (ctx, { after = [] }) => {
      const organization = ctx.var.organization;
      if (!after.length || !organization) return;
      const { setupConfig } = withSetupConfigDefaults(organization);
      const rows = after.flatMap((project) =>
        buildPrimaryLabelRows({
          entries: setupConfig.primaryLabels,
          projectId: project.id,
          organizationId: organization.id,
          tenantId: organization.tenantId,
          createdBy: ctx.var.actor.id,
        }),
      );
      // On the dispatcher's connection: create-projects dispatches inside its transaction, where the project rows are
      // not visible to any other connection yet.
      if (rows.length) await insertLabels(ctx, { labels: rows });
    },
    // Labels sort by heat: the tasks written carry it onto their labels, inside the write's transaction.
    'task.created': async (ctx, { after = [] }) => {
      await bumpLabelHeat(ctx, collectLabelHeat(after));
    },
    'task.updated': async (ctx, { before = [], after = [] }) => {
      await bumpLabelHeat(ctx, collectLabelHeat(after, before));
    },
    // Diff-driven: propagate primary-label edits to tracked child rows only when they changed.
    'organization.updated': async (ctx, { before = [], after = [] }) => {
      for (const [index, org] of after.entries()) {
        const nextLabels = org.setupConfig.primaryLabels;
        if (!nextLabels || JSON.stringify(before[index]?.setupConfig.primaryLabels) === JSON.stringify(nextLabels)) continue;
        await tenantContext(ctx, (txCtx) =>
          propagateSetupConfigLabels(txCtx, { entries: nextLabels, organizationId: org.id, updatedBy: ctx.var.actor.id }),
        );
      }
    },
  },
});
