import { z } from '@hono/zod-openapi';
import type { ChannelEntityType } from 'shared';
import { labelColorTokens, primaryLabelLimits } from 'shared/config/labels-config';
import { validNameSchema } from '#/schemas';
import { iconNameSchema } from '#/schemas/icon-name-schema';
import { labelSlugSchema } from '#/schemas/label-slug-schema';

/**
 * App-owned fields on template wire schemas (pinned). The template ships empty shapes; raak fills
 * them here so its data validates on the wire and reaches the SDK types without editing the
 * template schema files that spread them.
 */

/** One primary label definition in an organization's setupConfig. */
const primaryLabelDefinitionSchema = z.object({
  slug: labelSlugSchema,
  name: validNameSchema,
  color: z.enum(labelColorTokens),
  icon: iconNameSchema.nullable(),
});

/**
 * Wire schema for `organization.setupConfig`: the per-organization primary label set.
 * `primaryLabels` is replaced wholesale on update; array order is display order and the first entry
 * is the default for new tasks.
 */
export const setupConfigSchema = z.object({
  primaryLabels: z
    .array(primaryLabelDefinitionSchema)
    .min(primaryLabelLimits.min)
    .max(primaryLabelLimits.max)
    .refine((entries) => new Set(entries.map((e) => e.slug)).size === entries.length, {
      message: 'Duplicate primary label slugs',
    }),
});

/**
 * Extra fields for a channel's `counts` object in the included schema, e.g.
 * `milestones: z.object({...}).optional()`, optional when only some operations populate them. Keep
 * the return a plain object literal (no ZodRawShape annotation) so the counts schema keeps exact
 * field inference for SDK generation.
 */
export const appChannelCountFields = (_entityType: ChannelEntityType) => ({});

/**
 * App notification types beyond the template's `mention`, `comment` and `reply`
 * (`modules/notification/notification-types.ts`), e.g. `['assigned']`. Each needs a
 * `notification.<type>` label in `app.json` and, for its digest line, `email.digest_line.<type>`.
 */
export const appNotificationTypes = [] as const;
