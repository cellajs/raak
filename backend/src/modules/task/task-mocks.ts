import { faker } from '@faker-js/faker';
import {
  generateMockEntityChannelIdColumns,
  MOCK_REF_DATE,
  mockBatchResponse,
  mockPaginated,
  mockProductColumns,
  mockUuid,
  withFakerSeed,
} from '#/mocks';
import { mockLabel } from '#/modules/label/label-mocks';
import type { TaskModel } from '#/modules/task/task-db';
import { TaskStatus } from '#/modules/task/task-properties';
import { mockAuditUsers, mockUserMinimalBase } from '#/schemas/entity-base-mocks';

const taskStatuses = Object.values(TaskStatus).filter((status): status is TaskStatus => typeof status === 'number');

/**
 * Generates a mock task with all fields populated.
 * Uses deterministic seeding - same key produces same data.
 * Channel entity ID columns are generated from the task hierarchy configuration.
 */
export const mockTask = (key = 'task:default'): TaskModel =>
  withFakerSeed(key, () => {
    const name = faker.lorem.sentence({ min: 3, max: 8 });
    const description = faker.lorem.paragraph();
    const base = mockProductColumns('task', { name, description });
    const channelIds = generateMockEntityChannelIdColumns('task');
    const summary = faker.lorem.sentence({ min: 5, max: 15 });
    const checkboxCount = faker.number.int({ min: 0, max: 10 });
    const publicAt =
      faker.helpers.maybe(
        () => faker.date.between({ from: new Date(base.createdAt), to: MOCK_REF_DATE }).toISOString(),
        { probability: 0.3 },
      ) ?? null;

    return {
      ...base,
      // Specific columns
      expandable: faker.datatype.boolean(),
      summary,
      summaryLength: summary.length,
      primaryLabelId: mockUuid(),
      displayOrder: faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }),
      status: faker.helpers.arrayElement(taskStatuses),
      statusChangedAt: base.createdAt,
      checkboxCount,
      checkedCount: faker.number.int({ min: 0, max: checkboxCount }),
      attachmentCount: faker.number.int({ min: 0, max: 5 }),
      labels: faker.helpers.multiple(() => mockUuid(), { count: { min: 0, max: 3 } }),
      assignedTo: faker.helpers.multiple(() => mockUuid(), { count: { min: 0, max: 2 } }),
      publicAt,
      // Channel entity columns
      ...channelIds,
    };
  });

const mockEmbeddedLabel = (id: string, key: string) => {
  const label = mockLabel(key);
  return {
    id,
    name: label.name,
    slug: label.slug,
    color: label.color,
    mode: label.mode,
    icon: label.icon,
    projectId: label.projectId,
  };
};

/** Task wire response with stored relation IDs hydrated to embedded users and labels. */
export const mockTaskResponse = (key = 'task:default') => {
  const task = mockTask(key);

  return {
    ...task,
    labels: task.labels.map((id, index) => mockEmbeddedLabel(id, `${key}:label:${index}`)),
    primaryLabel: mockEmbeddedLabel(task.primaryLabelId, `${key}:primary-label`),
    assignedTo: task.assignedTo.map((id, index) => ({
      ...mockUserMinimalBase(`${key}:assigned-to:${index}`, id),
    })),
    ...mockAuditUsers(task, key),
  };
};

export const mockBatchTasksResponse = (count = 2) => mockBatchResponse(mockTaskResponse, count);

export const mockTasksResponse = (count = 2) => mockPaginated(mockTaskResponse, count, 25);
