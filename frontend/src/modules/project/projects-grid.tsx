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
}

export function ProjectsGrid({ fixedQuery, saveDataInSearch, focusView }: ProjectsGridProps) {
  const { search: baseSearch, setSearch } = useSearchParams({ saveDataInSearch });

  const search: ProjectSearch = { ...baseSearch, ...fixedQuery };
  const ofAnotherUser = useUserStore((state) => !!search.relatableUserId && search.relatableUserId !== state.user?.id);

  const queryOptions = projectsListQueryOptions({ ...search, include: 'counts,members' });

  const isFiltered = !!search.q;

  const { rows: entities, isLoading, isFetching, error, hasNextPage, fetchMore } = useInfiniteRows(queryOptions);

  return (
    <div className="flex h-full flex-col gap-2 pt-4">
      <EntityGridBar
        queryKey={queryOptions.queryKey}
        searchVars={baseSearch}
        label="c:project"
        entityType="project"
        // The role is the listed user's own: the server refuses it as a filter on another user's list
        roleFilter={!ofAnotherUser}
        // On a profile the bar is what names these tiles beside the organizations grid, so it stays for a short list
        alwaysShow={!!search.relatableUserId}
        setSearch={setSearch}
        focusView={focusView}
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
