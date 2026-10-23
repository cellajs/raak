import { useQuery } from '@tanstack/react-query';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { taskQueryOptions } from '~/modules/task/query';

/** Subscribes to a task in the cache; without `taskId` (e.g. the create form) the query is disabled and `data` stays undefined. */
export function useTaskQuery(taskId: string | undefined) {
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  return useQuery({ ...taskQueryOptions(taskId ?? '', organizationId, tenantId), enabled: !!taskId });
}
