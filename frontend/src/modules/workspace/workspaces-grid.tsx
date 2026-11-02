import { useInfiniteRows } from '~/modules/common/data-table/use-infinite-rows';
import { BaseEntityGrid } from '~/modules/entities/entity-grid';
import { useMenu } from '~/modules/navigation/menu-sheet/helpers/use-menu';
import { useCurrentUser } from '~/modules/user/user-store';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { WorkspaceTile } from '~/modules/workspace/workspace-tile';

export function WorkspacesGrid() {
  const user = useCurrentUser();
  const { menu } = useMenu(user.id);
  const { rows: entities, isLoading, isFetching, error, hasNextPage, fetchMore } = useInfiniteRows(workspacesListQueryOptions({}));

  return (
    <BaseEntityGrid
      label="c:workspace"
      renderTile={(entity) => <WorkspaceTile entity={entity} menuItem={menu.workspace.find((item) => item.id === entity.id)} />}
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
