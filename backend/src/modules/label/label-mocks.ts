import { faker } from '@faker-js/faker';
import { labelSlug } from 'shared/config/labels-config';
import {
  generateMockEntityChannelIdColumns,
  mockBatchResponse,
  mockPaginated,
  mockProductColumns,
  withFakerSeed,
} from '#/mocks';
import type { LabelModel } from '#/modules/label/label-db';

/**
 * Generates a mock label with all fields populated.
 * Uses deterministic seeding - same key produces same data.
 * Channel entity ID columns are generated from the label hierarchy configuration.
 * @param key - Seed key for deterministic output
 * @param suffix - Optional suffix to append to name for uniqueness in seeding
 */
export const mockLabel = (key = 'label:default', suffix?: string): LabelModel =>
  withFakerSeed(key, () => {
    const baseName = faker.helpers.arrayElement([
      'bug',
      'feature',
      'enhancement',
      'documentation',
      'urgent',
      'low priority',
    ]);
    const channelIds = generateMockEntityChannelIdColumns('label');

    const name = suffix ? `${baseName}-${suffix}` : baseName;

    return {
      ...mockProductColumns('label', { name, description: faker.lorem.sentence() }),
      // Specific columns
      color: faker.color.rgb().toLowerCase(),
      mode: 'secondary' as const,
      slug: labelSlug(name),
      icon: null,
      organizationTracked: false,
      displayOrder: null,
      // Channel entity columns
      ...channelIds,
    };
  });

/** Label wire response omits stored audit-user ID columns. */
export const mockLabelResponse = (key = 'label:default', suffix?: string) => {
  const { createdBy: _createdBy, updatedBy: _updatedBy, ...label } = mockLabel(key, suffix);
  return label;
};

export const mockBatchLabelsResponse = (count = 2) => mockBatchResponse(mockLabelResponse, count);

export const mockPaginatedLabelsResponse = (count = 2) => mockPaginated(mockLabelResponse, count);
