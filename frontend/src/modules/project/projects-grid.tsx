import type { ReactNode } from 'react';
import { useSearchParams } from '~/hooks/use-search-params';
import { useInfiniteRows } from '~/modules/common/data-table/use-infinite-rows';
import { BaseEntityGrid, ChannelTile, EntityGridBar } from '~/modules/entities/entity-grid';
import { projectsListQueryOptions } from '~/modules/project/query';
import { useUserStore } from '~/modules/user/user-store';

type ProjectSearch = Parameters<typeof projectsListQueryOptions>[0];

interface ProjectsGridProps {
  fixedQuery?: Partial<ProjectSearch>;
  focusView?: boolean;
  saveDataInSearch?: boolean;
  /** Keeps the bar up for a short list too, so the toggle stays reachable. */
  viewToggle?: ReactNode;
}

export function ProjectsGrid({ fixedQuery, saveDataInSearch, focusView, viewToggle }: ProjectsGridProps) {
  const { search: baseSearch, setSearch } = useSearchParams({ saveDataInSearch });

  const search: ProjectSearch = { ...baseSearch, ...fixedQuery };
  const ofAnotherUser = useUserStore((state) => !!search.relatableUserId && search.relatableUserId !== state.user?.id);

  const queryOptions = projectsListQueryOptions({ ...search, include: 'counts,members' });

  const isFiltered = !!search.q;

  const { rows: entities, isLoading, isFetching, error, hasNextPage, fetchMore } = useInfiniteRows(queryOptions);

  return (
    <div className="flex h-full flex-col gap-2">
      <EntityGridBar
        queryKey={queryOptions.queryKey}
        searchVars={baseSearch}
        label="c:project"
        entityType="project"
        // The server refuses a role on another user's list (it is theirs) and on an organization-wide one (it narrows to the caller's)
        roleFilter={!ofAnotherUser && search.scope !== 'organization'}
        // On a profile the bar is what names these tiles beside the organizations grid, so it stays for a short list
        alwaysShow={!!search.relatableUserId || !!viewToggle}
        setSearch={setSearch}
        focusView={focusView}
        viewToggle={viewToggle}
      />

      <BaseEntityGrid
        label="c:project"
        renderTile={(entity) => <ChannelTile entity={entity} hideOwnRole={ofAnotherUser} />}
        entities={entities}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        hasNextPage={hasNextPage}
        fetchMore={fetchMore}
        isFiltered={isFiltered}
      />
    </div>
  );
}
