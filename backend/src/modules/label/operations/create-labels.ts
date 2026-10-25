import type { z } from '@hono/zod-openapi';
import type { ChannelEntityType } from 'shared';
import { labelName, labelSlug } from 'shared/config/labels-config';
import type { OrgContext } from '#/core/context';
import { AppError } from '#/core/error';
import { buildStx } from '#/core/stx';
import { tenantContext, tenantRead } from '#/db/tenant-context';
import { dispatchMutation } from '#/lib/mutation-bus';
import { getOrganizationEntityCount } from '#/modules/entities/entities-queries';
import { type InsertLabelModel, type LabelModel, labelsTable } from '#/modules/label/label-db';
import { findLabelsByOrg, insertLabels } from '#/modules/label/label-queries';
import { labelContract, type labelCreateManyStxBodySchema } from '#/modules/label/label-schema';
import { getValidChannel } from '#/permissions';
import { buildSubject } from '#/permissions/build-subject';
import { canCreateEntity } from '#/permissions/can-create';
import { resolvePlacement } from '#/permissions/product-placement';
import { checkIdempotency } from '#/utils/idempotency';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

type CreateLabelsInput = z.infer<typeof labelCreateManyStxBodySchema>;

export async function createLabelsOp(
  ctx: OrgContext,
  rawInput: CreateLabelsInput,
): Promise<{ data: LabelModel[]; rejectedIds: string[]; replayed: boolean }> {
  // Lens seam: canonicalize old-shape field names before any body access
  const input = rawInput.map((item) => labelContract.normalizeCreateItem(item));
  const { organization, tenant } = ctx.var;
  const labelRestrictions = tenant.restrictions.quotas.label;

  if (labelRestrictions !== 0 && input.length > labelRestrictions) {
    throw new AppError(403, 'restrict_by_org', 'warn', { entityType: 'label' });
  }

  // Rows an earlier attempt of this create wrote come back as they are; only the other items are created.
  const replayed = await checkIdempotency(
    ctx,
    labelsTable,
    input.map((item) => item.id),
  );
  const replayedIds = new Set(replayed.map((row) => row.id));
  const fresh = input.filter((item) => !replayedIds.has(item.id));
  if (fresh.length === 0) return { data: replayed, rejectedIds: [], replayed: true };

  // Check restriction limits. Concurrent requests may slightly overshoot.
  const currentCount = await getOrganizationEntityCount(ctx, { organizationId: organization.id, entityType: 'label' });

  if (labelRestrictions !== 0 && currentCount + fresh.length > labelRestrictions) {
    throw new AppError(403, 'restrict_by_org', 'warn', { entityType: 'label' });
  }

  // Creating primary/epic labels requires project-admin authority (project update permission)
  const managedHome = async (homeCtx: OrgContext, id: string, type: ChannelEntityType) => (await getValidChannel(homeCtx, id, type, 'update')).entity;

  // Fetch existing labels in org for duplicate check and color matching
  const existingLabels = await tenantRead(ctx, (readCtx) => findLabelsByOrg(readCtx));

  const labelsToInsert: InsertLabelModel[] = [];
  for (const { stx, ...labelInfo } of fresh) {
    if (labelInfo.name) labelInfo.name = labelName(labelInfo.name, labelInfo.mode);

    // Maintain same color for labels already in organization
    const sameLabelInOrg = existingLabels.find(({ name }) => name === labelInfo.name);
    if (sameLabelInOrg) labelInfo.color = sameLabelInOrg.color;

    const { columns: placement } = await resolvePlacement(
      ctx,
      'label',
      labelInfo,
      labelInfo.mode === 'secondary' ? {} : { resolveHome: managedHome },
    );

    const label = {
      ...labelInfo,
      ...placement,
      slug: labelInfo.slug ?? labelSlug(labelInfo.name ?? 'New label'),
      entityType: 'label' as const,
      tenantId: organization.tenantId,
      organizationId: organization.id,
      createdAt: getIsoDate(),
      createdBy: ctx.var.actor.id,
      stx: buildStx(stx),
    };

    canCreateEntity(ctx, buildSubject('label', label));
    labelsToInsert.push(label);
  }

  const labelRecords = await tenantContext(ctx, async (txCtx) => {
    const rows = await insertLabels(txCtx, { labels: labelsToInsert });
    // Inside the transaction, so mutation handlers join the write.
    await dispatchMutation(txCtx, 'label.created', { after: rows });
    return rows;
  });

  log.info('Labels created', { count: labelRecords.length });

  // An attempt of this create running at the same time and committing first leaves this insert without those rows
  const insertedIds = new Set(labelRecords.map((row) => row.id));
  const missingIds = fresh.map((item) => item.id).filter((id) => !insertedIds.has(id));
  const committedMeanwhile = missingIds.length > 0 ? await checkIdempotency(ctx, labelsTable, missingIds) : [];

  return { data: [...replayed, ...labelRecords, ...committedMeanwhile], rejectedIds: [], replayed: false };
}
