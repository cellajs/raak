import type { ChannelEntityType } from 'shared';
// Side-effect: registers raak's channel-path resolver so the sync engine derives sub-org
// grant-boundary views and resolves the covering channel for delta fetches (project/workspace channels).
import '~/query/realtime/register-channel-paths';
import { attachmentsCanonicalOptions } from '~/modules/attachment/query';
import { labelsCanonicalOptions } from '~/modules/label/query';
import { membersListQueryOptions } from '~/modules/memberships/query';
import { organizationsListQueryOptions } from '~/modules/organization/query';
import { projectsListQueryOptions } from '~/modules/project/query';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import type { BuildEntitySyncQueriesParams, ChannelEntityListQueryMap, EntitySyncQueryOptions } from '~/query/types';

/**
 * Maps channel entity types to their list query options (used for menu generation).
 */
export const channelEntityListQueriesByType = {
  organization: (params) => organizationsListQueryOptions(params),
  workspace: (params) => workspacesListQueryOptions(params),
  project: (params) => projectsListQueryOptions(params),
} satisfies ChannelEntityListQueryMap;

/** Returns query options to sync for a given entity. React Query handles staleness. */
export const buildEntitySyncQueries = ({
  targetEntityId,
  targetEntityType,
  tenantId,
  currentOrganizationId,
  includeMemberQueries,
}: BuildEntitySyncQueriesParams) => {
  const syncQueries: EntitySyncQueryOptions[] = [];

  const memberListLimit = 200;
  const queryOrganizationId = targetEntityType === 'organization' ? targetEntityId : currentOrganizationId;

  const addMembersQuery = (channelEntityType: ChannelEntityType) => {
    if (includeMemberQueries) {
      syncQueries.push(
        membersListQueryOptions({
          entityId: targetEntityId,
          tenantId,
          organizationId: queryOrganizationId,
          entityType: channelEntityType,
          limit: memberListLimit,
        }),
      );
    }
  };

  switch (targetEntityType) {
    case 'organization': {
      addMembersQuery('organization');
      syncQueries.push(attachmentsCanonicalOptions({ tenantId, organizationId: targetEntityId }));
      break;
    }

    case 'workspace': {
      addMembersQuery('workspace');
      break;
    }

    case 'project': {
      addMembersQuery('project');
      syncQueries.push(
        tasksCanonicalOptions({ organizationId: currentOrganizationId, tenantId, projectId: targetEntityId }),
      );
      syncQueries.push(
        labelsCanonicalOptions({ organizationId: currentOrganizationId, tenantId, projectId: targetEntityId }),
      );
      break;
    }

    default:
      break;
  }

  return syncQueries;
};
