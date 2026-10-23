import { z } from '@hono/zod-openapi';
import { schemaTags } from '#/core/openapi-helpers';
import { evolutionContract } from '#/core/schema-evolution/evolution-contract';
import { arrayDeltaSchema } from '#/core/stx/array-delta';
import { createInsertSchema, createSelectSchema } from '#/db/utils/drizzle-schema';
import { labelEmbeddedSchema } from '#/modules/label/label-schema';
import { tasksTable } from '#/modules/task/task-db';
import { mockTaskResponse } from '#/modules/task/task-mocks';
import { TaskStatus } from '#/modules/task/task-properties';
import { placementFieldsSchema, validatePlacement } from '#/permissions/product-placement';
import {
  batchResponseSchema,
  maxLength,
  paginationQuerySchema,
  productListQuerySchema,
  stxBaseSchema,
  uniqueIdsSchema,
  validIdSchema,
  validUuidSchema,
} from '#/schemas';
import { auditShape, tombstoneShape } from '#/schemas/entity-base';
import { userMinimalBaseSchema } from '#/schemas/minimal-base';

const taskRelationDeltaSchema = arrayDeltaSchema(validUuidSchema);

const taskInsertSchema = createInsertSchema(tasksTable, { description: z.string().max(maxLength.html).nullable() });
const taskSelectSchema = createSelectSchema(tasksTable);

export const taskSchema = z
  .object({
    ...taskSelectSchema.omit({ labels: true, assignedTo: true, stx: true }).shape,
    labels: z.array(labelEmbeddedSchema),
    // Hydrated from primaryLabelId; null only when the referenced row is missing from the relation set
    primaryLabel: labelEmbeddedSchema.nullable(),
    status: z.enum(TaskStatus),
    assignedTo: z.array(userMinimalBaseSchema),
    ...auditShape,
    ...tombstoneShape,
    stx: stxBaseSchema,
  })
  .openapi('Task', {
    description: 'A task representing a unit of work, assignable to users with status tracking and labels.',
    example: mockTaskResponse(),
    'x-tags': schemaTags('data', 'tasks', 'app'),
  });

const taskCreateSchema = taskInsertSchema.pick({ name: true, description: true }).extend({
  id: validUuidSchema,
  status: z.enum(TaskStatus),
  // Optional on the wire: the server falls back to the project's default primary label
  primaryLabelId: validUuidSchema.optional(),
  displayOrder: z.number().optional(),
  labels: uniqueIdsSchema().optional(),
  assignedTo: uniqueIdsSchema().optional(),
  ...placementFieldsSchema('task'),
});

/** Wire registration: lens-widened schemas + entity-bound runtime seams for task */
export const taskContract = evolutionContract.product('task', {
  createItem: taskCreateSchema,
  updateOps: {
    name: z.string().max(maxLength.field),
    description: z.string().max(maxLength.html).nullable(),
    status: z.enum(TaskStatus),
    primaryLabelId: validUuidSchema,
    displayOrder: z.number(),
    labels: taskRelationDeltaSchema,
    assignedTo: taskRelationDeltaSchema,
    projectId: validUuidSchema,
    public: z.boolean(),
  },
  blockFields: ['description'],
});

/** Update body using fields pattern for single or multi-field updates with conflict detection */
export const taskUpdateStxBodySchema = taskContract.updateBodySchema;

const taskListQueryShape = {
  matchMode: z.enum(['all', 'any']).default('all'),
  sort: z.enum(['projectId', 'status', 'createdBy', 'updatedAt', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('asc'),
  acceptedCutOff: z.coerce.number().positive().optional(),
  projectId: validIdSchema.optional(),
  workspaceId: validIdSchema.optional(),
};

/** Base schema without refinement or range reads - use this when you need .omit()/.pick() */
export const taskListQueryBaseSchema = paginationQuerySchema.extend(taskListQueryShape);

export const taskListQuerySchema = productListQuerySchema(taskListQueryShape).refine((data) => !data.projectId || !data.workspaceId, {
  message: 'Only one of projectId or workspaceId can be provided',
});

// Stx-wrapped schemas for product entity mutations (items lens-widened via the wire)
export const taskCreateManyStxBodySchema = taskContract.createItemSchema
  .array()
  .min(1)
  .max(50)
  .superRefine((items, ctx) => {
    items.forEach((item, index) => {
      const issue = validatePlacement('task', item);
      if (issue) ctx.addIssue({ code: 'custom', path: [index, ...issue.path], message: issue.message });
    });
  });
export const taskCreateResponseSchema = batchResponseSchema(taskSchema);

export const taskLinkSchema = z.object({
  taskId: z.string(),
  projectId: z.string(),
  projectSlug: z.string(),
  organizationId: z.string(),
  organizationSlug: z.string(),
  tenantId: z.string(),
  public: z.boolean(),
});
