import { z } from '@hono/zod-openapi';
import { schemaTags } from '#/core/openapi-helpers';
import { createUpdateSchema } from '#/core/stx';
import { arrayDeltaSchema } from '#/core/stx/array-delta';
import { createInsertSchema, createSelectSchema } from '#/db/utils/drizzle-schema';
import { labelEmbeddedSchema } from '#/modules/label/label-schema';
import { tasksTable } from '#/modules/task/task-db';
import { mockTaskResponse } from '#/modules/task/task-mocks';
import { TaskStatus, TaskVariant } from '#/modules/task/task-properties';
import { batchResponseSchema, maxLength, paginationQuerySchema, stxBaseSchema, validUuidSchema } from '#/schemas';
import { userMinimalBaseSchema } from '#/schemas/user-minimal-base';

const taskInsertSchema = createInsertSchema(tasksTable, {
  description: z.string().max(maxLength.html).nullable(),
});
const taskSelectSchema = createSelectSchema(tasksTable);

export const taskSchema = z
  .object({
    ...taskSelectSchema.omit({
      labels: true,
      createdBy: true,
      assignedTo: true,
      updatedBy: true,
      variant: true,
      stx: true,
    }).shape,
    labels: z.array(labelEmbeddedSchema),
    status: z.enum(TaskStatus),
    variant: z.enum(TaskVariant),
    assignedTo: z.array(userMinimalBaseSchema),
    createdBy: z.object({ ...userMinimalBaseSchema.shape }).nullable(),
    updatedBy: z.object({ ...userMinimalBaseSchema.shape }).nullable(),
    stx: stxBaseSchema,
  })
  .openapi('Task', {
    description: 'A task representing a unit of work, assignable to users with status tracking and labels.',
    example: mockTaskResponse(),
    'x-tags': schemaTags('data', 'tasks', 'app'),
  });

const taskCreateSchema = taskInsertSchema
  .pick({
    name: true,
    description: true,
    projectId: true,
    points: true,
  })
  .extend({
    id: validUuidSchema,
    status: z.enum(TaskStatus),
    variant: z.enum(TaskVariant),
    displayOrder: z.number().optional(),
    labels: z.array(z.string()).optional(),
    assignedTo: z.array(z.string()).optional(),
  });

/** Update body using fields pattern for single or multi-field updates with conflict detection */
export const taskUpdateStxBodySchema = createUpdateSchema({
  name: z.string().max(maxLength.field),
  description: z.string().max(maxLength.html).nullable(),
  status: z.number().int(),
  variant: z.number().int(),
  points: z.number().int().nullable(),
  displayOrder: z.number(),
  labels: arrayDeltaSchema,
  assignedTo: arrayDeltaSchema,
  projectId: z.string().max(maxLength.id),
});

/** Base schema without refinement - use this when you need .omit()/.pick() */
export const taskListQueryBaseSchema = paginationQuerySchema.extend({
  matchMode: z.enum(['all', 'any']).default('all').optional(),
  sort: z
    .enum(['projectId', 'status', 'createdBy', 'variant', 'updatedAt', 'createdAt'])
    .default('createdAt')
    .optional(),
  order: z.enum(['asc', 'desc']).default('asc').optional(),
  acceptedCutOff: z.coerce.number().positive().optional(),
  projectId: z.string().max(maxLength.id).optional(),
  workspaceId: z.string().max(maxLength.id).optional(),
});

export const taskListQuerySchema = taskListQueryBaseSchema.refine((data) => !data.projectId || !data.workspaceId, {
  message: 'Only one of projectId or workspaceId can be provided',
});

// Stx-wrapped schemas for product entity mutations
const taskCreateStxBodySchema = taskCreateSchema.extend({ stx: stxBaseSchema });
export const taskCreateManyStxBodySchema = taskCreateStxBodySchema.array().min(1).max(50);
export const taskCreateResponseSchema = batchResponseSchema(taskSchema);
