import { faker } from '@faker-js/faker';
import { UniqueEnforcer } from 'enforce-unique';
import { hierarchy } from 'shared';
import slugify from 'slugify';
import {
  MOCK_REF_DATE,
  mockBatchResponse,
  mockNanoid,
  mockPaginated,
  mockPastIsoDate,
  mockUuid,
  withFakerSeed,
} from '#/mocks';
import type { MembershipBaseModel } from '#/modules/memberships/helpers/select';
import { mockMembershipBase } from '#/modules/memberships/memberships-mocks';
import type { InsertProjectModel, ProjectModel } from '#/modules/project/project-db';

// Enforces unique project names
const projectName = new UniqueEnforcer();

/**
 * Generates base project fields shared between insert and response mocks.
 * @param id - Project ID
 * @param name - Project name
 * @param createdAt - Creation timestamp
 * @param organizationId - Parent organization ID
 */
const generateProjectBase = (id: string, name: string, createdAt: string, organizationId: string, tenantId: string) => {
  const slug = slugify(name, { lower: true, strict: true });

  return {
    id,
    entityType: 'project' as const,
    name,
    slug,
    description: faker.lorem.sentence(),
    thumbnailUrl: null,
    bannerUrl: null,
    publicAt: faker.datatype.boolean() ? faker.date.past({ refDate: createdAt }).toISOString() : null,
    tenantId,
    organizationId,
    createdAt,
    publishedAt: createdAt,
    createdBy: null,
    updatedAt: createdAt,
    updatedBy: null,
    // Generated column in the live schema (channelPathColumn); mocks mirror the SQL rule.
    path: hierarchy.computeChannelPath('project', { id, organizationId }),
  };
};

/**
 * Generates a mock project row with all fields populated.
 * Used for DB seeding, tests, and as base for API response examples.
 * @param suffix - Optional suffix to append to name (bypasses UniqueEnforcer for seeding)
 */
export const mockProject = (suffix?: string): InsertProjectModel => {
  const baseName = faker.commerce.productName();
  const name = suffix ? `${baseName} ${suffix}` : projectName.enforce(() => baseName);
  return generateProjectBase(mockUuid(), name, mockPastIsoDate(), mockUuid(), mockNanoid());
};

/**
 * Generates a mock project API response with deterministic seeding.
 * Adds API-only fields (membership, counts) to the base mock.
 */
export const mockProjectResponse = (
  key = 'project:default',
): ProjectModel & {
  included: {
    membership: MembershipBaseModel;
  };
} =>
  withFakerSeed(key, () => {
    const refDate = MOCK_REF_DATE;
    const createdAt = faker.date.past({ refDate }).toISOString();
    const projectId = mockUuid();
    const organizationId = mockUuid();
    const tenantId = mockNanoid();

    // Generate base project fields
    const base = generateProjectBase(projectId, faker.commerce.productName(), createdAt, organizationId, tenantId);

    // Generate membership base with the project ID
    const membership = mockMembershipBase(`${key}:membership`);
    membership.projectId = projectId;
    membership.organizationId = organizationId;

    return {
      ...base,
      included: {
        membership,
      },
    };
  });

/**
 * Generates a paginated mock project list response for getProjects endpoint.
 */
export const mockPaginatedProjectsResponse = (count = 2) => mockPaginated(mockProjectResponse, count);

/**
 * Generates a batch mock project response for createProjects endpoint.
 */
export const mockBatchProjectsResponse = (count = 1) => mockBatchResponse(mockProjectResponse, count);
