import type { PrimaryLabelDefinition } from 'shared';
import { tenantContext } from '#/db/tenant-context';
import { defineBackendModule } from '#/lib/module';
import { buildPrimaryLabelRows, propagateSetupConfigLabels } from '#/modules/label/helpers/primary-labels';
import { insertLabels } from '#/modules/label/label-queries';
import { updateLabelOp } from '#/modules/label/operations/update-label';
import { withSetupConfigDefaults } from '#/modules/organization/helpers/select';

const primaryLabelsOf = (row: Record<string, unknown> | undefined): PrimaryLabelDefinition[] | undefined =>
  (row?.setupConfig as { primaryLabels?: PrimaryLabelDefinition[] } | undefined)?.primaryLabels;

defineBackendModule({
  name: 'labels',
  owner: 'app',
  scope: ['frontend', 'backend'],
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
          projectId: project.id as string,
          organizationId: organization.id,
          tenantId: organization.tenantId,
          createdBy: ctx.var.user.id,
        }),
      );
      if (rows.length) await tenantContext(ctx, (txCtx) => insertLabels(txCtx, { labels: rows }));
    },
    // Diff-driven: propagate primary-label edits to tracked child rows only when they changed.
    'organization.updated': async (ctx, { before = [], after = [] }) => {
      for (const [index, org] of after.entries()) {
        const nextLabels = primaryLabelsOf(org);
        if (!nextLabels || JSON.stringify(primaryLabelsOf(before[index])) === JSON.stringify(nextLabels)) continue;
        await tenantContext(ctx, (txCtx) =>
          propagateSetupConfigLabels(txCtx, {
            entries: nextLabels,
            organizationId: org.id as string,
            updatedBy: ctx.var.user.id,
          }),
        );
      }
    },
  },
});
