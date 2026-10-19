import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from '~/hooks/use-search-params';
import { BaseEntityGrid, ChannelTile, EntityGridBar } from '~/modules/entities/entity-grid';
import { useUserStore } from '~/modules/user/user-store';
import { projectsListQueryOptions } from './query';

type ProjectSearch = Parameters<typeof projectsListQueryOptions>[0];

interface Props {
  fixedQuery?: Partial<ProjectSearch>;
  focusView?: boolean;
  saveDataInSearch?: boolean;
  /** When true, show only 3 items with a "Show all" button */
  limitedView?: boolean;
}

export function ProjectsGrid({ fixedQuery, saveDataInSearch, focusView, limitedView: initialLimitedView }: Props) {
  const [expanded, setExpanded] = useState(false);
  const limitedView = initialLimitedView && !expanded;

  const { search: baseSearch, setSearch } = useSearchParams({ saveDataInSearch });

  const search: ProjectSearch = { ...baseSearch, ...(fixedQuery ?? {}) };
  const ofAnotherUser = useUserStore((state) => !!search.relatableUserId && search.relatableUserId !== state.user?.id);

  const queryOptions = projectsListQueryOptions({ ...search, include: 'counts,members' });

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
          entityType="project"
          // The role is the listed user's own: the server refuses it as a filter on another user's list
          roleFilter={!ofAnotherUser}
          // On a profile the bar is what names these tiles beside the organizations grid, so it stays for a short list
          alwaysShow={!!search.relatableUserId}
          setSearch={setSearch}
          focusView={focusView}
        />
      )}

      <BaseEntityGrid
        label="c:project"
        renderTile={(entity) => <ChannelTile entity={entity} hideOwnRole={ofAnotherUser} />}
        entities={entities}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        isFiltered={isFiltered}
        limitedView={limitedView}
        onExpand={() => setExpanded(true)}
        queryKey={queryOptions.queryKey}
      />
    </div>
  );
}
