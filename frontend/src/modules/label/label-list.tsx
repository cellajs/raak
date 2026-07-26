import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { BirdIcon, FlagIcon, TagIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { InfiniteLoader } from '~/modules/common/data-table/infinite-loader';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { searchHighlightRowClass } from '~/modules/common/search-highlight';
import { Spinner } from '~/modules/common/spinner';
import { groupLabelRows } from '~/modules/label/group-labels';
import { LabelFilterButton } from '~/modules/label/label-filter';
import { labelsQueryOptions } from '~/modules/label/query';
import type { LabelRow, LabelsScopeProps } from '~/modules/label/types';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { ScrollArea, ScrollBar } from '~/modules/ui/scroll-area';
import { cn } from '~/utils/cn';

/** Highlight-mode match over the same columns the server search filters on (name + keywords). */
const matchesSearch = (row: LabelRow, words: string[]) =>
  words.every((word) => row.name.toLowerCase().includes(word) || row.keywords.toLowerCase().includes(word));

/**
 * Tile list for the labels panel (secondary tags + epics), styled after the task panel's
 * list body: semantic ul/li rows in a ScrollArea, whole tile opens the label page. The
 * shared board search filters it; a '=' query highlights matches instead of filtering.
 */
export const LabelList = ({ entity, entityId }: LabelsScopeProps) => {
  const { t } = useTranslation();
  const { organization, tenantId } = useOrganizationLayoutContext();
  const organizationId = organization.id;

  const { search } = useSearchParams<{ q?: string }>({});
  const { highlight, effectiveQ } = parseSearchQuery(search.q);
  // Highlight mode fetches unfiltered and tints client-side, mirroring the board panels
  const q = highlight ? '' : (search.q ?? '');

  const { data, isLoading, isFetching, error, fetchNextPage, hasNextPage } = useInfiniteQuery({
    ...labelsQueryOptions({
      ...(entity === 'workspace' ? { workspaceId: entityId } : { projectId: entityId }),
      organizationId,
      tenantId,
      modes: 'secondary,epic',
      q,
    }),
    select: ({ pages }) => pages.flatMap(({ items }) => items),
  });

  const rows = useMemo(() => groupLabelRows(data ?? []), [data]);
  const highlightWords = useMemo(
    () => (highlight ? effectiveQ.toLowerCase().split(/\s+/).filter(Boolean) : []),
    [highlight, effectiveQ],
  );

  if (isLoading) return <Spinner className="my-8 h-6 w-6 opacity-50" />;
  if (!rows.length) {
    return (
      <ContentPlaceholder
        icon={BirdIcon}
        title="c:no_resource_yet"
        titleProps={{ resource: t('c:label_other').toLowerCase() }}
      />
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <ScrollBar />
      <ul aria-label={t('c:label_other')}>
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              to="."
              replace={false}
              resetScroll={false}
              search={(prev) => ({ ...prev, labelPageId: row.id })}
              className={cn(
                'flex w-full items-center gap-2 border-b px-3 py-2.5 text-left text-sm outline-0 ring-0 hover:bg-accent/30 focus-visible:bg-accent/30',
                highlight && matchesSearch(row, highlightWords) && searchHighlightRowClass,
              )}
            >
              {row.mode === 'epic' ? (
                <FlagIcon className="icon-md shrink-0 opacity-70" aria-hidden="true" />
              ) : (
                <TagIcon className="icon-md shrink-0 opacity-50" aria-hidden="true" />
              )}
              <span className="grow truncate">{row.name}</span>
              <LabelFilterButton name={row.name} size="xs" tabIndex={-1} />
              {entity === 'workspace' && row.projectIds.length > 1 && (
                <AvatarGroup limit={3}>
                  <AvatarGroupList>
                    {row.projectIds
                      .map((id) => findProjectByIdOrSlug(id, tenantId))
                      .filter((project) => !!project)
                      .map((project) => (
                        <EntityAvatar
                          type="project"
                          key={project.id}
                          id={project.id}
                          name={project.name}
                          url={project.thumbnailUrl}
                          className="h-6 w-6 text-xs"
                        />
                      ))}
                  </AvatarGroupList>
                  <AvatarOverflowIndicator className="h-6 w-6 text-xs" />
                </AvatarGroup>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <InfiniteLoader
        hasNextPage={hasNextPage}
        isFetching={isFetching}
        isFetchMoreError={!!error}
        hideEndIndicator
        fetchMore={fetchNextPage}
      />
    </ScrollArea>
  );
};
