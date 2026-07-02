import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { tenantRead } from '#/db/tenant-context';
import type { LabelModel } from '#/modules/label/label-db';
import { findLabelUsedCount } from '#/modules/label/label-queries';
import { getValidProductEntity } from '#/permissions/get-product-entity';

export async function getLabelOp(
  ctx: AuthContext,
  id: string,
): Promise<OperationResult<LabelModel & { usedCount: number }>> {
  const { label, usedCount } = await tenantRead(ctx, async (readCtx) => {
    const { entity: label } = await getValidProductEntity(readCtx, id, 'label', 'read');
    const usedCount = await findLabelUsedCount(readCtx, { labelId: id });
    return { label, usedCount };
  });

  return { success: true, data: { ...label, usedCount } };
}
