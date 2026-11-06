import { BirdIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { useInfiniteRows } from '~/modules/common/data-table/use-infinite-rows';
import { SearchScope } from '~/modules/common/match-highlight/match-scope';
import { BaseEntityGrid, ChannelTile, EntityGridBar, gridSortDefaults, gridSortOptions } from '~/modules/entities/entity-grid';
import { projectsListQueryOptions } from '~/modules/project/query';
import { useUserStore } from '~/modules/user/user-store';

type ProjectSearch = NonNullable<Parameters<typeof projectsListQueryOptions>[0]>;
type ProjectGridSearch = { q?: string; sort: NonNullable<ProjectSearch['sort']>; order: NonNullable<ProjectSearch['order']> };

const sortOptions = [gridSortOptions.name, gridSortOptions.createdAt] as const;

interface ProjectsGridProps {
  fixedQuery?: Partial<ProjectSearch>;
  focusView?: boolean;
  saveDataInSearch?: boolean;
  /** Keeps the bar up for a short list too, so the toggle stays reachable. */
  viewToggle?: ReactNode;
  /** Offered under "No projects yet", when no search narrows the list. */
  emptyAction?: ReactNode;
}

export function ProjectsGrid({ fixedQuery, saveDataInSearch, focusView, viewToggle, emptyAction }: ProjectsGridProps) {
  const { t } = useTranslation();
  const { search: baseSearch, setSearch } = useSearchParams<ProjectGridSearch>({ saveDataInSearch, defaults: gridSortDefaults(sortOptions) });

  const search: ProjectSearch = { ...baseSearch, ...fixedQuery };
  const ofAnotherUser = useUserStore((state) => !!search.relatableUserId && search.relatableUserId !== state.user?.id);

  const queryOptions = projectsListQueryOptions({ ...search, include: 'counts,members' });

  const isFiltered = !!search.q;

  const { rows: entities, isLoading, isFetching, error, hasNextPage, fetchMore } = useInfiniteRows(queryOptions);
  const offersEmptyAction = !!emptyAction && !isFiltered && !isFetching && !error && entities?.length === 0;

  return (
    <div className="flex h-full flex-col gap-2">
      <EntityGridBar
        queryKey={queryOptions.queryKey}
        searchVars={baseSearch}
        sortOptions={sortOptions}
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

      {offersEmptyAction ? (
        <ContentPlaceholder icon={BirdIcon} title="c:no_resource_yet" titleOptions={{ resource: t('c:project', { count: 0 }) }}>
          {emptyAction}
        </ContentPlaceholder>
      ) : (
        <SearchScope q={search.q}>
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
            onResetFilters={() => setSearch({ q: '' })}
          />
        </SearchScope>
      )}
    </div>
  );
}
