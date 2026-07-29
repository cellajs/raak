import { z } from '@hono/zod-openapi';
import { getColumns } from 'drizzle-orm';
import { labelModes } from 'shared';
import { schemaTags } from '#/core/openapi-helpers';
import { evolutionContract } from '#/core/schema-evolution/evolution-contract';
import { createInsertSchema, createSelectSchema } from '#/db/utils/drizzle-schema';
import { labelsTable } from '#/modules/label/label-db';
import { mockLabelResponse } from '#/modules/label/label-mocks';
import { batchResponseSchema, maxLength, paginationQuerySchema, stxBaseSchema, validUuidSchema } from '#/schemas';
import { iconNameSchema } from '#/schemas/icon-name-schema';
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
    mode: z.enum(labelModes).default('secondary'),
    slug: z.string().max(maxLength.field).optional(),
    icon: iconNameSchema.nullable().optional(),
    displayOrder: z.number().optional(),
  });

export const labelSchema = z
  .object({
    ...labelSelectSchema.omit({
      stx: true,
      createdBy: true,
      updatedBy: true,
    }).shape,
    mode: z.enum(labelModes),
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
  slug: z.string(),
  color: z.string().nullable(),
  mode: z.enum(labelModes),
  icon: z.string().nullable(),
  projectId: z.string(),
});

/** Drizzle select object for fetching only embedded label columns */
type LabelEmbeddedKeys = keyof typeof labelEmbeddedSchema.shape;
export const labelEmbeddedSelect = pick(
  getColumns(labelsTable),
  Object.keys(labelEmbeddedSchema.shape) as LabelEmbeddedKeys[],
);

/** Wire registration: lens-widened schemas + entity-bound runtime seams for label */
export const labelContract = evolutionContract.product('label', {
  createItem: labelCreateSchema,
  updateOps: {
    name: z.string().max(maxLength.field),
    color: z.string().max(maxLength.field).nullable(),
    slug: z.string().max(maxLength.field),
    icon: iconNameSchema.nullable(),
    displayOrder: z.number(),
    // Epic documentation; the update op rejects description edits on other modes
    description: z.string().max(maxLength.html).nullable(),
    // Tag <-> epic transitions (admin-gated in the op); primary rows never change mode
    mode: z.enum(['secondary', 'epic']),
    // Setting true relinks a primary label to its setupConfig entry (server re-syncs fields)
    organizationTracked: z.boolean(),
  },
});

/** Update body using fields pattern for single or multi-field updates with conflict detection */
export const labelUpdateStxBodySchema = labelContract.updateBodySchema;

export const labelListQuerySchema = paginationQuerySchema
  .extend({
    sort: z.enum(['name', 'usedCount']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc'),
    // Comma-separated label modes, e.g. ?modes=secondary,epic
    modes: z
      .string()
      .optional()
      .transform((val) => (val ? val.split(',').map((s) => s.trim()) : undefined))
      .pipe(z.array(z.enum(labelModes)).optional()),
    projectId: z.string().max(maxLength.id).optional(),
    workspaceId: z.string().max(maxLength.id).optional(),
  })
  .refine((data) => !data.projectId || !data.workspaceId, {
    message: 'Only one of projectId or workspaceId can be provided',
  });

export const labelCreateManyStxBodySchema = labelContract.createItemSchema.array().min(1).max(50);
export const labelCreateResponseSchema = batchResponseSchema(labelSchema);
