import { z } from '@hono/zod-openapi';
import { labelColorTokens, primaryLabelLimits } from 'shared';
import { maxLength, validNameSchema } from '#/schemas';
import { iconNameSchema } from '#/schemas/icon-name-schema';

/** One primary label definition in an organization's setupConfig. */
const primaryLabelDefinitionSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(maxLength.field)
    .regex(/^[a-z0-9][a-z0-9-]*$/),
  name: validNameSchema,
  color: z.enum(labelColorTokens),
  icon: z.union([iconNameSchema, z.null()]),
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
