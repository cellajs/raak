import type { PrimaryLabelDefinition } from 'shared';
import type { AuthContext } from '#/core/context';
import { tenantContext } from '#/db/tenant-context';
import { propagateSetupConfigLabels } from '#/modules/label/helpers/primary-labels';
import type { OrganizationModel } from '#/modules/organization/organization-db';

/**
 * Fork hook fired after an organization update, once its config defaults are merged and before cache
 * invalidation (so a fork write is visible to the same request). Receives the request ctx, the merged
 * organization row, and the normalized update body.
 *
 * raak override: fan edited primary-label definitions out to still-tracked rows across the org's
 * projects.
 */
export const onOrganizationUpdated = async (
  ctx: AuthContext,
  { organization, input }: { organization: OrganizationModel; input: Record<string, unknown> },
): Promise<void> => {
  const primaryLabels = (input.setupConfig as { primaryLabels?: PrimaryLabelDefinition[] } | undefined)?.primaryLabels;
  if (!primaryLabels) return;

  await tenantContext(ctx, (txCtx) =>
    propagateSetupConfigLabels(txCtx, {
      entries: primaryLabels,
      organizationId: organization.id,
      updatedBy: ctx.var.user.id,
    }),
  );
};
