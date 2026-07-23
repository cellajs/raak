import { faker } from '@faker-js/faker';
import {
  generateMockChannelIdColumns,
  MOCK_REF_DATE,
  mockBatchResponse,
  mockStx,
  mockTenantId,
  mockUuid,
  withFakerSeed,
} from '#/mocks';
import type { TaskModel } from '#/modules/task/task-db';

/**
 * Generates a mock task with all fields populated.
 * Uses deterministic seeding - same key produces same data.
 * Channel entity ID columns are generated dynamically based on relatable channel entity types.
 */
export const mockTask = (key = 'task:default'): TaskModel =>
  withFakerSeed(key, () => {
    const refDate = MOCK_REF_DATE;
    const createdAt = faker.date.past({ refDate }).toISOString();
    const userId = mockUuid();
    const channelIds = generateMockChannelIdColumns('relatable');

    return {
      id: mockUuid(),
      entityType: 'task' as const,
      name: faker.lorem.sentence({ min: 3, max: 8 }),
      description: faker.lorem.paragraph(),
      keywords: faker.lorem.words(3),
      // Specific columns
      expandable: faker.datatype.boolean(),
      summary: faker.lorem.sentence({ min: 5, max: 15 }),
      summaryLength: faker.number.int({ min: 0, max: 500 }),
      variant: faker.number.int({ min: 0, max: 3 }),
      points: faker.helpers.maybe(() => faker.number.int({ min: 1, max: 13 }), { probability: 0.7 }) ?? null,
      displayOrder: faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
      status: faker.number.int({ min: 0, max: 5 }),
      statusChangedAt: createdAt,
      checkboxCount: faker.number.int({ min: 0, max: 10 }),
      checkedCount: faker.number.int({ min: 0, max: 5 }),
      attachmentCount: faker.number.int({ min: 0, max: 5 }),
      attachments: faker.helpers.multiple(() => mockUuid(), { count: { min: 0, max: 3 } }),
      labels: faker.helpers.multiple(() => mockUuid(), { count: { min: 0, max: 3 } }),
      assignedTo: faker.helpers.multiple(() => mockUuid(), { count: { min: 0, max: 2 } }),
      publicAt: faker.helpers.maybe(() => faker.date.past({ refDate }).toISOString(), { probability: 0.3 }) ?? null,
      // Channel entity columns
      tenantId: mockTenantId(),
      ...channelIds,
      // Audit fields
      createdAt,
      createdBy: userId,
      updatedAt: createdAt,
      updatedBy: userId,
      deletedAt: null,
      deletedBy: null,
      seq: faker.number.int({ min: 1, max: 500 }),
      stx: mockStx(),
    };
  });

/** Alias for API response examples (task schema matches DB schema) */
export const mockTaskResponse = mockTask;

/**
 * Generates a mock batch tasks response for createTasks endpoint.
 */
export const mockBatchTasksResponse = (count = 2) => mockBatchResponse(mockTaskResponse, count);

/**
 * Generates a mock tasks list response for getTasks endpoint.
 */
export const mockTasksResponse = (count = 2) => ({
  items: Array.from({ length: count }, (_, i) => mockTaskResponse(`task:${i}`)),
  total: 25,
});
