import { faker } from '@faker-js/faker';
import { UniqueEnforcer } from 'enforce-unique';
import {
  generateMockChannelCounts,
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
  return {
    ...mockChannelColumns('workspace', {
      id,
      name,
      createdAt,
      updatedAt: createdAt,
      tenantId,
      channelIds: { organizationId },
    }),
    organizationId,
    toolsConfig: {},
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
    counts: ReturnType<typeof generateMockChannelCounts>;
  };
} =>
  withFakerSeed(key, () => {
    const createdAt = mockPastIsoDate();
    const workspaceId = mockUuid();
    const organizationId = mockUuid();

    // Generate base workspace fields
    const tenantId = mockTenantId();
    const base = generateWorkspaceBase(workspaceId, faker.company.buzzNoun(), createdAt, organizationId, tenantId);

    // Generate membership base with the workspace ID
    const membership = mockMembershipBase(`${key}:membership`, {
      channelType: 'workspace',
      channelId: workspaceId,
      channelIds: { workspaceId, organizationId },
      tenantId,
    });

    return {
      ...base,
      included: {
        membership,
        counts: generateMockChannelCounts('workspace', `${key}:counts`),
      },
    };
  });

export const mockPaginatedWorkspacesResponse = (count = 2) => mockPaginated(mockWorkspaceResponse, count);

export const mockBatchWorkspacesResponse = (count = 1) => mockBatchResponse(mockWorkspaceResponse, count);
