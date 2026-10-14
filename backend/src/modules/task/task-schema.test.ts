import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { describe, expect, it } from 'vitest';
import { TaskStatus } from '#/modules/task/task-properties';
import { taskCreateManyStxBodySchema, taskSchema, taskUpdateStxBodySchema } from '#/modules/task/task-schema';
import { mockStxFor } from '#/schemas/sync-transaction-mocks';

const firstId = '00000000-0000-4000-8000-000000000001';
const secondId = '00000000-0000-4000-8000-000000000002';

describe('task mutation schemas', () => {
  it('accepts only declared task statuses on update', () => {
    const validUpdate = { ops: { status: TaskStatus.Started }, stx: mockStxFor('status') };
    expect(taskUpdateStxBodySchema.safeParse(validUpdate).success).toBe(true);
    expect(taskUpdateStxBodySchema.safeParse({ ...validUpdate, ops: { status: 999 } }).success).toBe(false);
  });

  it('validates and bounds task relation IDs on create', () => {
    const validTask = {
      id: firstId,
      name: 'Task',
      description: null,
      projectId: secondId,
      status: TaskStatus.Unstarted,
      labels: [firstId],
      assignedTo: [secondId],
      stx: mockStxFor(),
    };

    expect(taskCreateManyStxBodySchema.safeParse([validTask]).success).toBe(true);
    expect(taskCreateManyStxBodySchema.safeParse([{ ...validTask, labels: ['not-an-id'] }]).success).toBe(false);
    expect(taskCreateManyStxBodySchema.safeParse([{ ...validTask, labels: [firstId, firstId] }]).success).toBe(false);
  });
});

describe('task OpenAPI composition', () => {
  it('uses a nullable type array for the inline primaryLabel object', () => {
    const registry = new OpenAPIRegistry();
    registry.register('Task', taskSchema);
    const schemas = new OpenApiGeneratorV31(registry.definitions).generateComponents().components?.schemas ?? {};

    expect(schemas).toMatchObject({
      Task: {
        properties: {
          primaryLabel: { type: ['object', 'null'] },
        },
      },
    });
  });
});
