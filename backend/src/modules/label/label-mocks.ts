import { faker } from '@faker-js/faker';
import { labelSlug } from 'shared';
import {
  generateMockChannelIdColumns,
  MOCK_REF_DATE,
  mockBatchResponse,
  mockPaginated,
  mockStx,
  mockTenantId,
  mockUuid,
  withFakerSeed,
} from '#/mocks';
import type { LabelModel } from '#/modules/label/label-db';

/**
 * Generates a mock label with all fields populated.
 * Uses deterministic seeding - same key produces same data.
 * Channel entity ID columns are generated dynamically based on appConfig.channelEntityTypes.
 * @param key - Seed key for deterministic output
 * @param suffix - Optional suffix to append to name for uniqueness in seeding
 */
export const mockLabel = (key = 'label:default', suffix?: string): LabelModel =>
  withFakerSeed(key, () => {
    const refDate = MOCK_REF_DATE;
    const createdAt = faker.date.past({ refDate }).toISOString();
    const userId = mockUuid();
    const baseName = faker.helpers.arrayElement([
      'bug',
      'feature',
      'enhancement',
      'documentation',
      'urgent',
      'low priority',
    ]);
    const channelIds = generateMockChannelIdColumns('relatable');

    const name = suffix ? `${baseName}-${suffix}` : baseName;

    return {
      id: mockUuid(),
      entityType: 'label' as const,
      name,
      description: faker.lorem.sentence(),
      keywords: faker.lorem.words(3),
      // Specific columns
      color: faker.color.rgb().toLowerCase(),
      mode: 'secondary' as const,
      slug: labelSlug(name),
      icon: null,
      organizationTracked: false,
      displayOrder: null,
      // Base product column: labels are not publicly readable
      publicAt: null,
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

/** Alias for API response examples (label schema matches DB schema) */
export const mockLabelResponse = mockLabel;

/**
 * Generates a batch mock label response for createLabels endpoint.
 */
export const mockBatchLabelsResponse = (count = 2) => mockBatchResponse(mockLabelResponse, count);

/**
 * Generates a paginated mock label list response for getLabels endpoint.
 */
export const mockPaginatedLabelsResponse = (count = 2) => mockPaginated(mockLabelResponse, count);
