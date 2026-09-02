import { z } from '@hono/zod-openapi';
import { labelColorTokens, primaryLabelLimits } from 'shared/config/labels-config';
import { validNameSchema } from '#/schemas';
import { iconNameSchema } from '#/schemas/icon-name-schema';
import { labelSlugSchema } from '#/schemas/label-slug-schema';

/** One primary label definition in an organization's setupConfig. */
const primaryLabelDefinitionSchema = z.object({
  slug: labelSlugSchema,
  name: validNameSchema,
  color: z.enum(labelColorTokens),
  icon: iconNameSchema.nullable(),
});

/**
 * Wire schema for `organization.setupConfig` (raak's fork override of cella's empty default): the
 * per-organization primary label set, wired into the organization response and update contract in
 * `organization-schema` so it validates on the wire and flows into the generated SDK type.
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
