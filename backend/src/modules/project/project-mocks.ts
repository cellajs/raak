import { faker } from '@faker-js/faker';
import { UniqueEnforcer } from 'enforce-unique';
import {
  MOCK_REF_DATE,
  mockBatchResponse,
  mockChannelColumns,
  mockPaginated,
  mockPastIsoDate,
  mockTenantId,
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
  const publicAt = faker.datatype.boolean()
    ? faker.date.between({ from: new Date(createdAt), to: MOCK_REF_DATE }).toISOString()
    : null;

  return {
    ...mockChannelColumns('project', {
      id,
      name,
      createdAt,
      updatedAt: createdAt,
      tenantId,
      publicAt,
      channelIds: { organizationId },
    }),
    organizationId,
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
  return generateProjectBase(mockUuid(), name, mockPastIsoDate(), mockUuid(), mockTenantId());
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
    const createdAt = mockPastIsoDate();
    const projectId = mockUuid();
    const organizationId = mockUuid();
    const tenantId = mockTenantId();

    // Generate base project fields
    const base = generateProjectBase(projectId, faker.commerce.productName(), createdAt, organizationId, tenantId);

    // Generate membership base with the project ID
    const membership = mockMembershipBase(`${key}:membership`, {
      channelType: 'project',
      channelId: projectId,
      channelIds: { projectId, organizationId },
      tenantId,
    });

    return {
      ...base,
      included: {
        membership,
      },
    };
  });

export const mockPaginatedProjectsResponse = (count = 2) => mockPaginated(mockProjectResponse, count);

export const mockBatchProjectsResponse = (count = 1) => mockBatchResponse(mockProjectResponse, count);
