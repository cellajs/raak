import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { membersListQueryOptions } from '~/modules/memberships/query';
import type { Member } from '~/modules/memberships/types';
import { flattenInfiniteData } from '~/query/basic/flatten';

/**
 * Members of a single project. The project-scoped member query can return rows whose
 * `membership` belongs to another entity, so the result is filtered to this project's
 * membership. Memoized on the query data + projectId for a stable reference.
 */
export const useProjectMembers = (projectId: string, tenantId: string, organizationId: string): Member[] => {
  const membersQuery = useInfiniteQuery(
    membersListQueryOptions({ entityId: projectId, tenantId, organizationId, entityType: 'project' }),
  );
  return useMemo(() => {
    const members = flattenInfiniteData<Member>(membersQuery.data);
    return members.filter(({ membership }) => membership.projectId === projectId);
  }, [membersQuery.data, projectId]);
};
