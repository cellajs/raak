import type { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import { AppError } from '#/core/error';
import type { OperationResult } from '#/core/operation-result';
import { tenantContext } from '#/db/tenant-context';
import type { LabelModel } from '#/modules/label/label-db';
import { updateLabel } from '#/modules/label/label-queries';
import { labelContract, type labelUpdateStxBodySchema } from '#/modules/label/label-schema';
import { withSetupConfigDefaults } from '#/modules/organization/helpers/select';
import { getValidChannel } from '#/permissions';
import { getValidProduct } from '#/permissions/get-valid-product';
import { getIsoDate } from '#/utils/iso-date';

type UpdateLabelInput = z.infer<typeof labelUpdateStxBodySchema>;

/** Field ops that unlink a tracked primary label from its organization setupConfig entry. */
const trackedFields = ['name', 'color', 'icon', 'slug'] as const;

export async function updateLabelOp(
  ctx: AuthContext,
  id: string,
  input: UpdateLabelInput,
): Promise<OperationResult<LabelModel>> {
  const { ops: rawOps, stx } = input;

  // Single tenantContext wraps permission check + write to avoid double-transaction pool pressure
  const updated = await tenantContext(ctx, async (txCtx) => {
    const { entity: before } = await getValidProduct(txCtx, id, 'label', 'update');

    // Managing primary/epic labels requires project-admin authority (project update permission)
    if (before.mode !== 'secondary') await getValidChannel(txCtx, before.projectId, 'project', 'update');

    const resolved = labelContract.resolveUpdateOps(before, rawOps, stx);

    const values: Partial<LabelModel> = {
      ...(resolved.changed ? resolved.values : {}),
      updatedAt: getIsoDate(),
      updatedBy: ctx.var.user.id,
      ...(resolved.changed ? { stx: resolved.stx } : {}),
    };

    if (before.mode === 'primary' && resolved.changed) {
      if (values.organizationTracked === true) {
        // Relink: re-sync the row from its setupConfig entry (server-authoritative reset)
        const { setupConfig } = withSetupConfigDefaults(ctx.var.organization);
        const entry = setupConfig.primaryLabels.find((e) => e.slug === before.slug);
        if (!entry) {
          throw new AppError(400, 'invalid_request', 'warn', {
            entityType: 'label',
            meta: { reason: 'No setupConfig entry matches this label slug' },
          });
        }
        Object.assign(values, { name: entry.name, color: entry.color, icon: entry.icon });
      } else if (before.organizationTracked && trackedFields.some((field) => field in resolved.values)) {
        // Any identity or appearance edit unlinks the row from organization tracking
        values.organizationTracked = false;
      }
    }

    return updateLabel(txCtx, { id, values });
  });

  return { success: true, data: updated };
}
