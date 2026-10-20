import { faker } from '@faker-js/faker';
import { labelName, labelSlug } from 'shared/config/labels-config';
import { generateMockEntityChannelIdColumns, mockBatchResponse, mockPaginated, mockProductColumns, withFakerSeed } from '#/mocks';
import type { LabelModel } from '#/modules/label/label-db';
import { labelSlugSchema } from '#/schemas/label-slug-schema';

const buildLabelVocabulary = (): string[] => {
  const { company, hacker, commerce } = faker.definitions;
  const words = [...company.noun, ...company.buzz_noun, ...hacker.noun, ...hacker.adjective, ...hacker.abbreviation, ...commerce.department];
  const namesBySlug = new Map<string, string>();
  for (const word of words) {
    const name = labelName(word, 'secondary');
    const slug = labelSlugSchema.safeParse(name);
    if (slug.success && !namesBySlug.has(slug.data)) namesBySlug.set(slug.data, name);
  }
  return [...namesBySlug.values()];
};

const labelVocabulary = buildLabelVocabulary();

/** Distinct secondary label names in the label name format, no two sharing a slug. */
export const mockLabelNames = (count: number): string[] => faker.helpers.arrayElements(labelVocabulary, count);

/**
 * Generates a mock secondary label with all fields populated.
 * Uses deterministic seeding - same key produces same data.
 * Channel entity ID columns are generated from the label hierarchy configuration.
 * @param key - Seed key for deterministic output
 * @param name - Label name; a vocabulary word when omitted
 */
export const mockLabel = (key = 'label:default', name?: string): LabelModel =>
  withFakerSeed(key, () => {
    const channelIds = generateMockEntityChannelIdColumns('label');
    const resolvedName = labelName(name ?? faker.helpers.arrayElement(labelVocabulary), 'secondary');

    return {
      ...mockProductColumns('label', { name: resolvedName, description: null, keywords: '' }),
      // Specific columns
      color: faker.color.rgb().toLowerCase(),
      mode: 'secondary' as const,
      slug: labelSlug(resolvedName),
      icon: null,
      organizationTracked: false,
      displayOrder: null,
      // Channel entity columns
      ...channelIds,
    };
  });

/** Label wire response omits stored audit-user ID columns. */
export const mockLabelResponse = (key = 'label:default', name?: string) => {
  const { createdBy: _createdBy, updatedBy: _updatedBy, ...label } = mockLabel(key, name);
  return label;
};

export const mockBatchLabelsResponse = (count = 2) => mockBatchResponse(mockLabelResponse, count);

export const mockPaginatedLabelsResponse = (count = 2) => mockPaginated(mockLabelResponse, count);
