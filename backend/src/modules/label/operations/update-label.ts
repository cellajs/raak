import type { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantContext } from '#/db/tenant-context';
import type { LabelModel } from '#/modules/label/label-db';
import { updateLabel } from '#/modules/label/label-queries';
import { labelContract, type labelUpdateStxBodySchema } from '#/modules/label/label-schema';
import { getValidProduct } from '#/permissions/get-valid-product';
import { getIsoDate } from '#/utils/iso-date';

type UpdateLabelInput = z.infer<typeof labelUpdateStxBodySchema>;

export async function updateLabelOp(
  ctx: AuthContext,
  id: string,
  input: UpdateLabelInput,
): Promise<OperationResult<LabelModel>> {
  const { ops: rawOps, stx } = input;

  // Single tenantContext wraps permission check + write to avoid double-transaction pool pressure
  const updated = await tenantContext(ctx, async (txCtx) => {
    const { entity: before } = await getValidProduct(txCtx, id, 'label', 'update');
    const resolved = labelContract.resolveUpdateOps(before, rawOps, stx);

    const values = {
      ...(resolved.changed ? resolved.values : {}),
      updatedAt: getIsoDate(),
      updatedBy: ctx.var.user.id,
      ...(resolved.changed ? { stx: resolved.stx } : {}),
    };
    return updateLabel(txCtx, { id, values });
  });

  return { success: true, data: updated };
}
