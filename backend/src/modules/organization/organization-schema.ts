import { z } from '@hono/zod-openapi';
import { t } from 'i18next';
import { appConfig, labelColorTokens, type OrganizationFlags, primaryLabelLimits, roles } from 'shared';
import { schemaTags } from '#/core/openapi-helpers';
import { evolutionContract } from '#/core/schema-evolution/evolution-contract';
import { createInsertSchema, createSelectSchema } from '#/db/utils/drizzle-schema';
import { membershipBaseSchema } from '#/modules/memberships/memberships-schema';
import { organizationsTable } from '#/modules/organization/organization-db';
import {
  booleanTransformSchema,
  excludeArchivedQuerySchema,
  iconNameSchema,
  includeQuerySchema,
  languageSchema,
  maxLength,
  noDuplicateSlugsRefine,
  paginationQuerySchema,
  validCDNUrlSchema,
  validNameSchema,
  validSlugSchema,
  validTempIdSchema,
  validUrlSchema,
} from '#/schemas';
import { channelIncludedSchema } from '#/schemas/channel-included';
import { userMinimalBaseSchema } from '#/schemas/user-minimal-base';
import { mockOrganizationResponse } from './organization-mocks';

const organizationIncludedSchema = channelIncludedSchema('organization');

/** Flag keys come from the fork-owned config, so the wire contract stays strictly typed per fork.
 *  Built loose then cast: with zero flags (cella default) `keyof OrganizationFlags` is `never`. */
export const organizationFlagsSchema = z.object(
  Object.keys(appConfig.defaultOrganizationFlags).reduce(
    (acc, key) => {
      acc[key] = z.boolean();
      return acc;
    },
    {} as Record<string, z.ZodBoolean>,
  ) as { [K in keyof OrganizationFlags]: z.ZodBoolean },
);

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
 * Per-organization setup config (fork-shaped). `primaryLabels` is replaced wholesale on
 * update; array order is display order and the first entry is the default for new tasks.
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

export const organizationSchema = z
  .object({
    ...createSelectSchema(organizationsTable).shape,
    createdBy: userMinimalBaseSchema.nullable(),
    updatedBy: userMinimalBaseSchema.nullable(),
    languages: z.array(languageSchema).min(1),
    organizationFlags: organizationFlagsSchema,
    setupConfig: setupConfigSchema,
    included: organizationIncludedSchema,
  })
  .openapi('Organization', {
    description: 'The main channel entity is an organization.',
    example: mockOrganizationResponse(),
    'x-tags': schemaTags('data', 'organizations', 'cella'),
  });

export const organizationWithMembershipSchema = organizationSchema.extend({
  included: organizationIncludedSchema.extend({ membership: membershipBaseSchema }),
});

/** Wire registration: lens-widened schemas + entity-bound runtime seam for organization */
export const organizationContract = evolutionContract.channel('organization', {
  createItem: z.object({
    id: validTempIdSchema,
    name: validNameSchema,
    slug: validSlugSchema,
  }),
  updateBody: createInsertSchema(organizationsTable, {
    slug: validSlugSchema,
    name: validNameSchema,
    shortName: validNameSchema.nullable(),
    languages: z.array(languageSchema).min(1),
    defaultLanguage: languageSchema.optional(),
    websiteUrl: validUrlSchema.nullable(),
    thumbnailUrl: validCDNUrlSchema.nullable(),
    bannerUrl: validCDNUrlSchema.nullable(),
    logoUrl: validCDNUrlSchema.nullable(),
    welcomeText: z.string().max(maxLength.html).nullable(),
    // Partial per key: a single flag can be toggled; the update query merges via jsonb ||
    organizationFlags: organizationFlagsSchema.partial(),
    // Partial per key: top-level keys merge via jsonb ||, so primaryLabels replaces wholesale
    setupConfig: setupConfigSchema.partial(),
  })
    .pick({
      slug: true,
      name: true,
      shortName: true,
      country: true,
      timezone: true,
      defaultLanguage: true,
      languages: true,
      notificationEmail: true,
      color: true,
      thumbnailUrl: true,
      logoUrl: true,
      bannerUrl: true,
      websiteUrl: true,
      welcomeText: true,
      chatSupport: true,
      organizationFlags: true,
      setupConfig: true,
    })
    .partial(),
});

/** Array schema for batch creates - rejects duplicate slugs */
export const organizationCreateBodySchema = organizationContract.createItemSchema
  .array()
  .min(1)
  .max(10)
  .refine(noDuplicateSlugsRefine, t('error:duplicate_slugs'));

export const organizationUpdateBodySchema = organizationContract.updateBodySchema;

export const organizationQuerySchema = z.object({
  slug: booleanTransformSchema.optional(),
  include: includeQuerySchema,
});

export const organizationListQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(['id', 'name', 'createdAt', 'displayOrder']).default('displayOrder').optional(),
  order: z.enum(['asc', 'desc']).default('asc').optional(),
  relatableUserId: z.string().max(maxLength.id).optional(),
  role: z.enum(roles.all).optional(),
  excludeArchived: excludeArchivedQuerySchema,
  include: includeQuerySchema,
});
