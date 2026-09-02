import type { ChannelEntityType } from 'shared';
import { attachmentsCanonicalOptions } from '~/modules/attachment/query';
import { labelsCanonicalOptions } from '~/modules/label/query';
import { membersListQueryOptions } from '~/modules/memberships/query';
import { organizationsListQueryOptions } from '~/modules/organization/query';
import { projectsListQueryOptions } from '~/modules/project/query';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import type { BuildEntitySyncQueriesParams, ChannelListQueryMap, EntitySyncQueryOptions } from '~/query/types';

/**
 * Maps channel entity types to their list query options, for menu generation.
 *
 * Each factory is wrapped in an arrow function so the (ESM live) binding is read at call time. A
 * direct reference throws "Cannot access X before initialization" when this module is evaluated
 * mid-cycle, for example during Vite HMR before the entity query module has initialized. See the
 * circular import chain via `~/query/realtime`.
 */
export const channelListQueriesByType = {
  organization: (params) => organizationsListQueryOptions(params),
  workspace: (params) => workspacesListQueryOptions(params),
  project: (params) => projectsListQueryOptions(params),
} satisfies ChannelListQueryMap;

/** Pure mapping: React Query owns staleness. */
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
