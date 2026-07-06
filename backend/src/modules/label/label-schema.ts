import { z } from '@hono/zod-openapi';
import { getColumns } from 'drizzle-orm';
import { createProductEntityWire } from '#/core/entity-wire';
import { schemaTags } from '#/core/openapi-helpers';
import { createInsertSchema, createSelectSchema } from '#/db/utils/drizzle-schema';
import { labelsTable } from '#/modules/label/label-db';
import { mockLabelResponse } from '#/modules/label/label-mocks';
import { batchResponseSchema, maxLength, paginationQuerySchema, stxBaseSchema, validUuidSchema } from '#/schemas';
import { pick } from '#/utils/pick';

const labelInsertSchema = createInsertSchema(labelsTable);
const labelSelectSchema = createSelectSchema(labelsTable);

const labelCreateSchema = labelInsertSchema
  .pick({
    name: true,
    projectId: true,
  })
  .extend({
    id: validUuidSchema,
    color: z.string().max(maxLength.field).nullable(),
  });

export const labelSchema = z
  .object({
    ...labelSelectSchema.omit({
      stx: true,
      createdBy: true,
      updatedBy: true,
    }).shape,
    stx: stxBaseSchema,
    usedCount: z.number().int().min(0).optional(),
  })
  .openapi('Label', {
    description: 'A label used to categorize and filter tasks within a project or workspace.',
    example: mockLabelResponse(),
    'x-tags': schemaTags('data', 'labels', 'app'),
  });

/** Embedded label schema for use in other entities (e.g. task.labels) */
export const labelEmbeddedSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
  projectId: z.string(),
});

/** Drizzle select object for fetching only embedded label columns */
type LabelEmbeddedKeys = keyof typeof labelEmbeddedSchema.shape;
export const labelEmbeddedSelect = pick(
  getColumns(labelsTable),
  Object.keys(labelEmbeddedSchema.shape) as LabelEmbeddedKeys[],
);

/** Wire registration: lens-widened schemas + entity-bound runtime seams for label */
export const labelWire = createProductEntityWire('label', {
  createItem: labelCreateSchema,
  updatable: {
    name: z.string().max(maxLength.field),
    color: z.string().max(maxLength.field).nullable(),
  },
});

/** Update body using fields pattern for single or multi-field updates with conflict detection */
export const labelUpdateStxBodySchema = labelWire.updateBodySchema;

export const labelListQuerySchema = paginationQuerySchema
  .extend({
    sort: z.enum(['name', 'usedCount']).default('name').optional(),
    order: z.enum(['asc', 'desc']).default('asc').optional(),
    projectId: z.string().max(maxLength.id).optional(),
    workspaceId: z.string().max(maxLength.id).optional(),
  })
  .refine((data) => !data.projectId || !data.workspaceId, {
    message: 'Only one of projectId or workspaceId can be provided',
  });

export const labelCreateManyStxBodySchema = labelWire.createItemSchema.array().min(1).max(50);
export const labelCreateResponseSchema = batchResponseSchema(labelSchema);
