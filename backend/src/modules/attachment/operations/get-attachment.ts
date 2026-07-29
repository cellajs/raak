import type { AuthContext } from '#/core/context';
import { getAttachmentViewCount } from '#/modules/attachment/attachment-queries';
import { withAuditUser } from '#/modules/user/helpers/audit-user';
import { getValidProduct } from '#/permissions/get-valid-product';

export async function getAttachmentOp(ctx: AuthContext, id: string) {
  const { entity: attachment } = await getValidProduct(ctx, id, 'attachment', 'read');

  // withAuditUser queries users (no RLS), getAttachmentViewCount queries counters (no RLS)
  const attachmentResponse = await withAuditUser(ctx, attachment);
  const viewCount = await getAttachmentViewCount(ctx, { entityId: id });

  return { ...attachmentResponse, viewCount };
}
