import type { ActorContext } from '#/core/context';
import { tenantRead } from '#/db/tenant-context';
import type { LabelModel } from '#/modules/label/label-db';
import { getValidProduct } from '#/permissions/get-valid-product';

export async function getLabelOp(ctx: ActorContext, id: string): Promise<LabelModel> {
  const { entity: label } = await tenantRead(ctx, (readCtx) => getValidProduct(readCtx, id, 'label', 'read'));
  return label;
}
