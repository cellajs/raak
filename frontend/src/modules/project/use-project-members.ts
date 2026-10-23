import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { membersListQueryOptions } from '~/modules/memberships/query';
import type { Member } from '~/modules/memberships/types';
import { flattenInfiniteData } from '~/query/basic/flatten';

/** Members of one project; the project-scoped query can return rows whose membership belongs to another entity. */
export const useProjectMembers = (projectId: string, tenantId: string, organizationId: string): Member[] => {
  const membersQuery = useInfiniteQuery(membersListQueryOptions({ entityId: projectId, tenantId, organizationId, entityType: 'project' }));
  // Memoized so consumers get a stable array between query updates.
  return useMemo(() => {
    const members = flattenInfiniteData<Member>(membersQuery.data);
    return members.filter(({ membership }) => membership.projectId === projectId);
  }, [membersQuery.data, projectId]);
};
