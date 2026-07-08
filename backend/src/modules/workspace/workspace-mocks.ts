import { faker } from '@faker-js/faker';
import { UniqueEnforcer } from 'enforce-unique';
import slugify from 'slugify';
import {
  generateMockFullCounts,
  MOCK_REF_DATE,
  type MockEntityCounts,
  type MockMembershipCounts,
  mockBatchResponse,
  mockPaginated,
  mockPastIsoDate,
  mockTenantId,
  mockUuid,
  withFakerSeed,
} from '#/mocks';
import type { MembershipBaseModel } from '#/modules/memberships/helpers/select';
import { mockMembershipBase } from '#/modules/memberships/memberships-mocks';
import type { InsertWorkspaceModel, WorkspaceModel } from '#/modules/workspace/workspace-db';

// Enforces unique workspace names
const workspaceName = new UniqueEnforcer();

/**
 * Generates base workspace fields shared between insert and response mocks.
 * @param id - Workspace ID
 * @param name - Workspace name
 * @param createdAt - Creation timestamp
 * @param organizationId - Parent organization ID
 */
const generateWorkspaceBase = (
  id: string,
  name: string,
  createdAt: string,
  organizationId: string,
  tenantId: string,
) => {
  const slug = slugify(name, { lower: true, strict: true });

  return {
    id,
    entityType: 'workspace' as const,
    name,
    slug,
    description: faker.lorem.sentence(),
    thumbnailUrl: null,
    bannerUrl: null,
    tenantId,
    organizationId,
    createdAt,
    createdBy: null,
    updatedAt: createdAt,
    updatedBy: null,
  };
};

/**
 * Generates a mock workspace row with all fields populated.
 * Used for DB seeding, tests, and as base for API response examples.
 * @param suffix - Optional suffix to append to name (bypasses UniqueEnforcer for seeding)
 */
export const mockWorkspace = (suffix?: string): InsertWorkspaceModel => {
  const baseName = faker.company.buzzNoun();
  const name = suffix ? `${baseName} ${suffix}` : workspaceName.enforce(() => baseName);
  return generateWorkspaceBase(mockUuid(), name, mockPastIsoDate(), mockUuid(), mockTenantId());
};

/**
 * Generates a mock workspace API response with deterministic seeding.
 * Adds API-only fields (membership, counts) to the base mock.
 */
export const mockWorkspaceResponse = (
  key = 'workspace:default',
): WorkspaceModel & {
  included: {
    membership: MembershipBaseModel;
    counts: {
      membership: MockMembershipCounts;
      entities: MockEntityCounts;
    };
  };
} =>
  withFakerSeed(key, () => {
    const refDate = MOCK_REF_DATE;
    const createdAt = faker.date.past({ refDate }).toISOString();
    const workspaceId = mockUuid();
    const organizationId = mockUuid();

    // Generate base workspace fields
    const base = generateWorkspaceBase(
      workspaceId,
      faker.company.buzzNoun(),
      createdAt,
      organizationId,
      mockTenantId(),
    );

    // Generate membership base with the workspace ID
    const membership = mockMembershipBase(`${key}:membership`);
    membership.workspaceId = workspaceId;
    membership.organizationId = organizationId;

    return {
      ...base,
      included: {
        membership,
        counts: generateMockFullCounts(`${key}:counts`),
      },
    };
  });

/**
 * Generates a paginated mock workspace list response for getWorkspaces endpoint.
 */
export const mockPaginatedWorkspacesResponse = (count = 2) => mockPaginated(mockWorkspaceResponse, count);

/**
 * Generates a batch mock workspace response for createWorkspaces endpoint.
 */
export const mockBatchWorkspacesResponse = (count = 1) => mockBatchResponse(mockWorkspaceResponse, count);
