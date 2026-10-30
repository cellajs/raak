import { useSearchParams } from '~/hooks/use-search-params';
import { useInfiniteRows } from '~/modules/common/data-table/use-infinite-rows';
import { SearchScope } from '~/modules/common/match-highlight/match-scope';
import { BaseEntityGrid, EntityGridBar } from '~/modules/entities/entity-grid';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { WorkspaceTile } from '~/modules/workspace/workspace-tile';

export function WorkspacesGrid() {
  const { search, setSearch } = useSearchParams<{ q?: string }>();

  const queryOptions = workspacesListQueryOptions({ ...search, excludeArchived: 'true' });

  const { rows: entities, isLoading, isFetching, error, hasNextPage, fetchMore } = useInfiniteRows(queryOptions);

  return (
    <div className="flex h-full flex-col gap-4">
      <EntityGridBar queryKey={queryOptions.queryKey} searchVars={search} label="c:workspace" entityType="workspace" setSearch={setSearch} />

      <SearchScope q={search.q}>
        <BaseEntityGrid
          label="c:workspace"
          renderTile={(entity) => <WorkspaceTile entity={entity} />}
          skeletonHeight={72}
          entities={entities}
          isLoading={isLoading}
          isFetching={isFetching}
          error={error}
          hasNextPage={hasNextPage}
          fetchMore={fetchMore}
          isFiltered={!!search.q}
        />
      </SearchScope>
    </div>
  );
}
