import { z } from '@hono/zod-openapi';
import { t } from 'i18next';
import { roles } from 'shared';
import { createContextEntityWire } from '#/core/entity-wire';
import { schemaTags } from '#/core/openapi-helpers';
import { createInsertSchema, createSelectSchema } from '#/db/utils/drizzle-schema';
import { membershipBaseSchema } from '#/modules/memberships/memberships-schema';
import { projectsTable } from '#/modules/project/project-db';
import { mockProjectResponse } from '#/modules/project/project-mocks';
import {
  batchResponseSchema,
  excludeArchivedQuerySchema,
  includeQuerySchema,
  maxLength,
  noDuplicateSlugsRefine,
  paginationQuerySchema,
  validCDNUrlSchema,
  validNameSchema,
  validSlugSchema,
  validTempIdSchema,
} from '#/schemas';
import { contextEntityIncludedSchema } from '#/schemas/context-entity-included';
import { userMinimalBaseSchema } from '#/schemas/user-minimal-base';

/** Task status counts for accepted/iced cutoff display */
const taskStatusCountsSchema = z.object({
  accepted: z.number(),
  reviewed: z.number(),
  delivered: z.number(),
  finished: z.number(),
  started: z.number(),
  unstarted: z.number(),
  iced: z.number(),
});

const baseIncluded = contextEntityIncludedSchema('project');
const projectIncludedSchema = baseIncluded.extend({
  counts: baseIncluded.shape.counts.unwrap().extend({ taskStatusCounts: taskStatusCountsSchema.optional() }).optional(),
});

export const projectSchema = z
  .object({
    ...createSelectSchema(projectsTable).shape,
    createdBy: userMinimalBaseSchema.nullable(),
    updatedBy: userMinimalBaseSchema.nullable(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
    included: projectIncludedSchema,
  })
  .openapi('Project', {
    description: 'A project that organizes tasks and members within an organization.',
    example: mockProjectResponse(),
    'x-tags': schemaTags('data', 'projects', 'app'),
  });

export const projectWithMembershipSchema = projectSchema.extend({
  included: projectIncludedSchema.extend({ membership: membershipBaseSchema }),
});

/** Wire registration: lens-widened schemas + entity-bound runtime seam for project */
export const projectWire = createContextEntityWire('project', {
  createItem: z.object({
    id: validTempIdSchema,
    name: validNameSchema,
    slug: validSlugSchema,
    publicAt: z.string().nullable(),
  }),
  updateBody: createInsertSchema(projectsTable, {
    slug: validSlugSchema,
    name: validNameSchema,
    thumbnailUrl: validCDNUrlSchema.nullable(),
    bannerUrl: validCDNUrlSchema.nullable(),
    publicAt: z.string().nullable(),
  })
    .pick({
      slug: true,
      name: true,
      thumbnailUrl: true,
      bannerUrl: true,
      publicAt: true,
    })
    .partial(),
});

/** Array schema for batch creates - rejects duplicate slugs */
export const projectCreateBodySchema = projectWire.createItemSchema
  .array()
  .min(1)
  .max(10)
  .refine(noDuplicateSlugsRefine, t('error:duplicate_slugs'));

export const projectCreateResponseSchema = batchResponseSchema(projectWithMembershipSchema);

export const workspaceIdQuery = z.object({ workspaceId: z.string().max(maxLength.id) });

export const projectUpdateBodySchema = projectWire.updateBodySchema;

export const projectListQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(['id', 'name', 'createdAt', 'displayOrder']).default('displayOrder').optional(),
  organizationId: z.string().max(maxLength.id).optional(),
  workspaceId: z.string().max(maxLength.id).optional(),
  relatableUserId: z.string().max(maxLength.id).optional(),
  role: z.enum(roles.all).optional(),
  excludeArchived: excludeArchivedQuerySchema,
  include: includeQuerySchema,
});
