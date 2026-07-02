import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from '~/hooks/use-search-params';
import { BaseEntityGrid, EntityGridBar } from '~/modules/entities/entity-grid';
import { workspacesListQueryOptions } from './query';
import { WorkspaceTile } from './tile';

type WorkspaceSearch = Parameters<typeof workspacesListQueryOptions>[0];

interface Props {
  fixedQuery?: Partial<WorkspaceSearch>;
  focusView?: boolean;
  saveDataInSearch?: boolean;
}

/**
 * Display a grid of workspace tiles.
 */
export function WorkspacesGrid({ fixedQuery, saveDataInSearch, focusView }: Props) {
  const { search: baseSearch, setSearch } = useSearchParams({ saveDataInSearch });

  const search: WorkspaceSearch = { ...baseSearch, ...(fixedQuery ?? {}) };

  const queryOptions = workspacesListQueryOptions({ ...search, excludeArchived: 'true' });

  const q = search.q ?? '';
  const isFiltered = !!q;

  const { data, isFetching, isLoading, error, hasNextPage, fetchNextPage } = useInfiniteQuery({
    ...queryOptions,
    select: (data) => data.pages.flatMap((p) => p.items),
  });

  return (
    <div className="flex h-full flex-col gap-4">
      <EntityGridBar
        queryKey={queryOptions.queryKey}
        searchVars={baseSearch}
        label={'c:workspace'}
        setSearch={setSearch}
        focusView={focusView}
      />

      <BaseEntityGrid
        label="c:workspace"
        tileComponent={WorkspaceTile}
        skeletonHeight={72}
        entities={data}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFiltered={isFiltered}
      />
    </div>
  );
}
