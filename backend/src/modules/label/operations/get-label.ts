import type { UserContext } from '#/core/context';
import { tenantRead } from '#/db/tenant-context';
import type { LabelModel } from '#/modules/label/label-db';
import { getLabelUsedCount } from '#/modules/label/label-queries';
import { getValidProduct } from '#/permissions/get-valid-product';

export async function getLabelOp(ctx: UserContext, id: string): Promise<LabelModel & { usedCount: number }> {
  const { label, usedCount } = await tenantRead(ctx, async (readCtx) => {
    const { entity: label } = await getValidProduct(readCtx, id, 'label', 'read');
    const usedCount = await getLabelUsedCount(readCtx, { labelId: id });
    return { label, usedCount };
  });

  return { ...label, usedCount };
}
