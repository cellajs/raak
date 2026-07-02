import { useQuery } from '@tanstack/react-query';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { taskQueryOptions } from '~/modules/task/query';

/**
 * Subscribe to a task in the cache. When `taskId` is omitted (e.g. inside the
 * create-task form, before any task exists) the query is disabled and `data`
 * stays undefined — callers should fall back to their own `value` prop.
 */
export function useTaskQuery(taskId: string | undefined) {
  const { tenantId, organization } = useOrganizationLayoutContext();
  return useQuery({
    ...taskQueryOptions(taskId ?? '', organization.id, tenantId),
    enabled: !!taskId,
  });
}
