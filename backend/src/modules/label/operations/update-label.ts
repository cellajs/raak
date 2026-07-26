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
import { extractKeywordsFromBlocks } from '#/utils/extract-keywords';
import { getIsoDate } from '#/utils/iso-date';
import { assertBlockMediaUrls } from '#/utils/validate-block-urls';

type UpdateLabelInput = z.infer<typeof labelUpdateStxBodySchema>;

/** Field ops that unlink a tracked primary label from its organization setupConfig entry. */
const trackedFields = ['name', 'color', 'icon', 'slug'] as const;

export async function updateLabelOp(
  ctx: AuthContext,
  id: string,
  input: UpdateLabelInput,
  opts: { serverOrigin?: boolean } = {},
): Promise<OperationResult<LabelModel>> {
  const { ops: rawOps, stx } = input;
  const { serverOrigin } = opts;

  // Single tenantContext wraps permission check + write to avoid double-transaction pool pressure
  const updated = await tenantContext(ctx, async (txCtx) => {
    const { entity: before } = await getValidProduct(txCtx, id, 'label', 'update');

    // Epic documentation is collaborative: any project member may edit an epic's description,
    // so description-only ops skip the project-admin gate below. Other modes never accept it.
    const opsKeys = Object.keys(rawOps ?? {});
    const descriptionOnly = opsKeys.length > 0 && opsKeys.every((key) => key === 'description');
    if ('description' in (rawOps ?? {}) && before.mode !== 'epic') {
      throw new AppError(403, 'forbidden', 'warn', {
        entityType: 'label',
        meta: { reason: 'Only epic labels carry a description' },
      });
    }

    // Primary rows are the org's task types; their mode never changes (the schema already
    // limits transitions to secondary <-> epic)
    const modeChange = 'mode' in (rawOps ?? {});
    if (modeChange && before.mode === 'primary') {
      throw new AppError(403, 'forbidden', 'warn', {
        entityType: 'label',
        meta: { reason: 'Primary labels cannot change mode' },
      });
    }

    // Managing primary/epic labels, and promoting a tag to an epic, requires project-admin
    // authority (project update permission)
    if ((before.mode !== 'secondary' || modeChange) && !descriptionOnly) {
      await getValidChannel(txCtx, before.projectId, 'project', 'update');
    }

    // Server-origin writes (Yjs description materialization) carry no client field timestamps,
    // so they stamp a fresh server HLC per changed scalar instead of resolving client HLCs.
    const resolved = serverOrigin
      ? labelContract.resolveServerUpdateOps(before, rawOps)
      : labelContract.resolveUpdateOps(before, rawOps, stx);

    const values: Partial<LabelModel> = {
      ...(resolved.changed ? resolved.values : {}),
      updatedAt: getIsoDate(),
      updatedBy: ctx.var.user.id,
      ...(resolved.changed ? { stx: resolved.stx } : {}),
    };

    if (resolved.changed && 'description' in resolved.values) {
      const description = resolved.values.description as string | null;
      if (description) {
        // Media URLs must come from trusted sources; keywords feed the shared board search
        assertBlockMediaUrls(description, 'label', 'description');
        values.keywords = extractKeywordsFromBlocks(description);
      } else {
        values.keywords = '';
      }
    }

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
