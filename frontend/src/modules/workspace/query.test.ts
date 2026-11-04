import '~/query/tests/query-client-env';
import type { Workspace } from 'sdk';
import { afterEach, describe, expect, it } from 'vitest';
import { addCreatedWorkspaceToLists, workspacesListQueryOptions } from '~/modules/workspace/query';
import { getQueryItems } from '~/query/basic/mutate-query';
import { queryClient } from '~/query/query-client';
import type { InfiniteQueryData } from '~/query/types';

const cacheEmptyList = (organizationId?: string) => {
  const { queryKey } = workspacesListQueryOptions({ organizationId });
  const empty: InfiniteQueryData<Workspace> = { pages: [{ items: [], total: 0 }], pageParams: [{ page: 0, offset: 0 }] };
  queryClient.setQueryData(queryKey, empty);
  return () => getQueryItems(queryClient.getQueryData<InfiniteQueryData<Workspace>>(queryKey) ?? empty).map(({ id }) => id);
};

afterEach(() => queryClient.clear());

describe('addCreatedWorkspaceToLists', () => {
  it("enters its own organization's list and the unfiltered list, not another organization's", () => {
    const ownList = cacheEmptyList('org-a');
    const otherList = cacheEmptyList('org-b');
    const unfilteredList = cacheEmptyList();

    addCreatedWorkspaceToLists({ id: 'new', organizationId: 'org-a' } as Workspace);

    expect(ownList()).toEqual(['new']);
    expect(unfilteredList()).toEqual(['new']);
    expect(otherList()).toEqual([]);
  });
});
