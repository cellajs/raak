import { z } from '@hono/zod-openapi';
import { roles } from 'shared';
import { createContextEntityWire } from '#/core/entity-wire';
import { schemaTags } from '#/core/openapi-helpers';
import { createInsertSchema, createSelectSchema } from '#/db/utils/drizzle-schema';
import { membershipBaseSchema } from '#/modules/memberships/memberships-schema';
import { workspacesTable } from '#/modules/workspace/workspace-db';
import { mockWorkspaceResponse } from '#/modules/workspace/workspace-mocks';
import {
  batchResponseSchema,
  excludeArchivedQuerySchema,
  includeQuerySchema,
  maxLength,
  paginationQuerySchema,
  validNameSchema,
  validTempIdSchema,
} from '#/schemas';
import { contextEntityIncludedSchema } from '#/schemas/context-entity-included';
import { userMinimalBaseSchema } from '#/schemas/user-minimal-base';

const workspaceIncludedSchema = contextEntityIncludedSchema('workspace');

export const workspaceSchema = z
  .object({
    ...createSelectSchema(workspacesTable).shape,
    createdBy: userMinimalBaseSchema.nullable(),
    updatedBy: userMinimalBaseSchema.nullable(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
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
export const workspaceWire = createContextEntityWire('workspace', {
  createItem: z.object({
    id: validTempIdSchema,
    name: validNameSchema,
  }),
  updateBody: createInsertSchema(workspacesTable, {
    name: validNameSchema,
  })
    .pick({ name: true })
    .partial(),
});

/** Array schema for batch creates */
export const workspaceCreateBodySchema = workspaceWire.createItemSchema.array().min(1).max(10);

export const workspaceCreateResponseSchema = batchResponseSchema(workspaceWithMembershipSchema);

export const workspaceUpdateBodySchema = workspaceWire.updateBodySchema;

export const workspaceListQuerySchema = paginationQuerySchema.extend({
  sort: z.enum(['id', 'name', 'createdAt', 'displayOrder']).default('displayOrder').optional(),
  organizationId: z.string().max(maxLength.id).optional(),
  role: z.enum(roles.all).optional(),
  excludeArchived: excludeArchivedQuerySchema,
  include: includeQuerySchema,
});
