import { z } from '@hono/zod-openapi';
import { roles } from 'shared';
import { schemaTags } from '#/core/openapi-helpers';
import { evolutionContract } from '#/core/schema-evolution/evolution-contract';
import { createInsertSchema, createSelectSchema } from '#/db/utils/drizzle-schema';
import { membershipBaseSchema } from '#/modules/memberships/memberships-schema';
import { workspacesTable } from '#/modules/workspace/workspace-db';
import { mockWorkspaceResponse } from '#/modules/workspace/workspace-mocks';
import {
  batchResponseSchema,
  excludeArchivedQuerySchema,
  includeQuerySchema,
  paginationQuerySchema,
  validIdSchema,
  validNameSchema,
  validTempIdSchema,
} from '#/schemas';
import { channelIncludedSchema } from '#/schemas/channel-included';
import { nullableUserMinimalBaseSchema } from '#/schemas/minimal-base';
import { toolsConfigSchema } from '#/schemas/tools-config';

const workspaceIncludedSchema = channelIncludedSchema('workspace');

export const workspaceSchema = z
  .object({
    ...createSelectSchema(workspacesTable).shape,
    createdBy: nullableUserMinimalBaseSchema,
    updatedBy: nullableUserMinimalBaseSchema,
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
    toolsConfig: toolsConfigSchema,
    included: workspaceIncludedSchema,
  })
  .openapi('Workspace', {
    description: 'A personal workspace that groups projects and tasks within an organization.',
    example: mockWorkspaceResponse(),
    'x-tags': schemaTags('data', 'workspaces', 'app'),
  });

export const workspaceWithMembershipSchema = workspaceSchema.extend({
  included: workspaceIncludedSchema.extend({ membership: membershipBaseSchema }),
});

/** Wire registration: lens-widened schemas + entity-bound runtime seam for workspace */
export const workspaceContract = evolutionContract.channel('workspace', {
  createItem: z.object({
    id: validTempIdSchema,
    name: validNameSchema,
  }),
  updateBody: createInsertSchema(workspacesTable, {
    name: validNameSchema,
    // toolsConfig merges via jsonb || on update: each listed slot key is replaced wholesale
    toolsConfig: toolsConfigSchema,
  })
    .pick({ name: true, toolsConfig: true })
    .partial(),
});

/** Array schema for batch creates */
export const workspaceCreateBodySchema = workspaceContract.createItemSchema.array().min(1).max(10);

export const workspaceCreateResponseSchema = batchResponseSchema(workspaceWithMembershipSchema);

export const workspaceUpdateBodySchema = workspaceContract.updateBodySchema;

export const workspaceListQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(['id', 'name', 'createdAt', 'displayOrder']).default('displayOrder'),
  order: z.enum(['asc', 'desc']).default('asc'),
  organizationId: validIdSchema.optional(),
  role: z.enum(roles.all).optional(),
  excludeArchived: excludeArchivedQuerySchema,
  include: includeQuerySchema,
});
