import type { z } from '@hono/zod-openapi';
import type { AuthContext } from '#/core/context';
import type { OperationResult } from '#/core/operation-result';
import { buildStx } from '#/core/stx';
import { tenantContext, tenantRead } from '#/db/tenant-context';
import { getOrgEntityCount } from '#/modules/entities/helpers/get-entity-counts';
import type { LabelModel } from '#/modules/label/label-db';
import { findLabelsByOrg, findLabelsByStxMutationId, insertLabels } from '#/modules/label/label-queries';
import { labelContract, type labelCreateManyStxBodySchema } from '#/modules/label/label-schema';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { checkIdempotency } from '#/utils/idempotency';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

type CreateLabelsInput = z.infer<typeof labelCreateManyStxBodySchema>;

export async function createLabelsOp(
  ctx: AuthContext,
  rawInput: CreateLabelsInput,
): Promise<OperationResult<{ data: LabelModel[]; rejectedIds: string[] }>> {
  // Lens seam: canonicalize old-shape field names before any body access
  const input = rawInput.map((item) => labelContract.normalizeCreateItem(item));
  const { organization, tenant } = ctx.var;
  const labelRestrictions = tenant.restrictions.quotas.label;

  if (labelRestrictions !== 0 && input.length > labelRestrictions) {
    return { success: false, error: 'restrict_by_org', status: 429 };
  }

  // Idempotency check
  const batchStxId = input[0].stx.mutationId;
  const existing = await checkIdempotency(batchStxId, () =>
    tenantRead(ctx, (readCtx) => findLabelsByStxMutationId(readCtx, { mutationId: batchStxId })),
  );
  if (existing) return { success: true, data: { data: existing, rejectedIds: [] } };

  // Check restriction limits. Concurrent requests may slightly overshoot.
  const currentCount = await getOrgEntityCount(ctx, organization.id, 'label');

  if (labelRestrictions !== 0 && currentCount + input.length > labelRestrictions) {
    return { success: false, error: 'restrict_by_org', status: 429 };
  }

  // Fetch existing labels in org for duplicate check and color matching
  const existingLabels = await tenantRead(ctx, (readCtx) => findLabelsByOrg(readCtx));

  // Prepare labels for insert
  const labelsToInsert = input.map(({ stx, ...labelInfo }) => {
    // Maintain same color for labels already in organization
    const sameLabelInOrg = existingLabels.find(({ name }) => name === labelInfo.name);
    if (sameLabelInOrg) labelInfo.color = sameLabelInOrg.color;

    const label = {
      ...labelInfo,
      entityType: 'label' as const,
      tenantId: organization.tenantId,
      organizationId: organization.id,
      createdAt: getIsoDate(),
      createdBy: ctx.var.user.id,
      stx: buildStx(stx),
    };

    canCreateEntity(ctx, buildSubject('label', label));
    return label;
  });

  const labelRecords = await tenantContext(ctx, (txCtx) => insertLabels(txCtx, { labels: labelsToInsert }));

  log.info('Labels created', { count: labelRecords.length });

  return { success: true, data: { data: labelRecords, rejectedIds: [] } };
}
