import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Project } from 'sdk';
import { useSearchParams } from '~/hooks/use-search-params';
import { BaseEntityGrid, EntityGridBar, EntityGridTile } from '~/modules/entities/entity-grid';
import { projectsListQueryOptions } from './query';

type ProjectSearch = Parameters<typeof projectsListQueryOptions>[0];

interface Props {
  fixedQuery?: Partial<ProjectSearch>;
  focusView?: boolean;
  saveDataInSearch?: boolean;
  /** When true, show only 3 items with a "Show all" button */
  limitedView?: boolean;
}

// EntityGridTile expects org-shaped `included.counts` but the tile only reads
// `counts.membership.total`, which Projects also provide. Use a wrapper type
// so BaseEntityGrid infers a Project-compatible generic without a full cast.
const tileComponent = EntityGridTile as typeof EntityGridTile & ((props: { entity: Project }) => React.JSX.Element);

export function ProjectsGrid({ fixedQuery, saveDataInSearch, focusView, limitedView: initialLimitedView }: Props) {
  const [expanded, setExpanded] = useState(false);
  const limitedView = initialLimitedView && !expanded;

  const { search: baseSearch, setSearch } = useSearchParams({ saveDataInSearch });

  const search: ProjectSearch = { ...baseSearch, ...(fixedQuery ?? {}) };

  const queryOptions = projectsListQueryOptions(search);

  const q = search.q ?? '';
  const isFiltered = !!q;

  const { data, isFetching, isLoading, error, hasNextPage, fetchNextPage } = useInfiniteQuery({
    ...queryOptions,
    select: (data) => data.pages.flatMap((p) => p.items),
  });

  const entities = data;

  return (
    <div className="flex h-full flex-col gap-2 pt-4">
      {!limitedView && (
        <EntityGridBar
          queryKey={queryOptions.queryKey}
          searchVars={baseSearch}
          label={'c:project'}
          setSearch={setSearch}
          isSheet={!focusView}
          focusView={focusView}
        />
      )}

      <BaseEntityGrid
        label="c:project"
        tileComponent={tileComponent}
        entities={entities}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFiltered={isFiltered}
        limitedView={limitedView}
        onExpand={() => setExpanded(true)}
      />
    </div>
  );
}
