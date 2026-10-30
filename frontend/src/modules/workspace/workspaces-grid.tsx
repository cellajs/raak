import { useInfiniteRows } from '~/modules/common/data-table/use-infinite-rows';
import { BaseEntityGrid } from '~/modules/entities/entity-grid';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { WorkspaceTile } from '~/modules/workspace/workspace-tile';

export function WorkspacesGrid() {
  const {
    rows: entities,
    isLoading,
    isFetching,
    error,
    hasNextPage,
    fetchMore,
  } = useInfiniteRows(workspacesListQueryOptions({ excludeArchived: 'true' }));

  return (
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
      isFiltered={false}
    />
  );
}
