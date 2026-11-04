import { useQuery } from '@tanstack/react-query';
import { Link, type LinkComponentProps } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { ActiveTabMarker, useTabIndicator } from '~/modules/common/page/tab-indicator';
import { TabNavShell, tabNavItemClass } from '~/modules/common/page/tab-nav-shell';
import { useScrollResetOnNavigate } from '~/modules/common/scroll-reset';
import { useStatusTabList } from '~/modules/task/board/board-hooks';
import { countTasksByStatus, statusesBottomUp } from '~/modules/task/helpers/board-helpers';
import { isBoardSearchActive } from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { publicTasksBoardQueryOptions } from '~/modules/task/public-query';
import { tasksCanonicalOptions } from '~/modules/task/query';
import { statusOptionsByValue } from '~/modules/task/task-properties';
import { cn } from '~/utils/cn';

interface StatusTab {
  id: string;
  content: ReactNode;
  search: LinkComponentProps['search'];
  activeOptions: LinkComponentProps['activeOptions'];
}

interface StatusTabNavProps {
  project: Pick<Project, 'id' | 'organizationId' | 'tenantId'>;
  publicView?: boolean;
}

/**
 * Status tabs of the mobile project board: All, then each status's icon and how many tasks it lists, from the cached board list, which holds accepted
 * tasks only since the cut-off. Narrow cells keep all seven on a phone. Also drawn by its skeleton, so the bar does not shift when the board loads.
 * A search spans every status, so it hides them.
 */
export function StatusTabNav({ project, publicView }: StatusTabNavProps) {
  const { t } = useTranslation();
  const search = useBoardSearch();
  const statuses = useStatusTabList();
  const indicator = useTabIndicator();
  const scrollToResetOnNavigate = useScrollResetOnNavigate();

  const queryOptions = publicView
    ? publicTasksBoardQueryOptions(project.id)
    : tasksCanonicalOptions({ organizationId: project.organizationId, tenantId: project.tenantId, projectId: project.id });
  // Reads the cache only: the board fetches the list. The public and authenticated options share a data shape; the cast widens the key type.
  const { data: counts } = useQuery({ ...(queryOptions as ReturnType<typeof tasksCanonicalOptions>), enabled: false, select: countTasksByStatus });

  if (isBoardSearchActive(search)) return null;

  const tabs: StatusTab[] = [
    // Exact: a partial match on an empty search would hold on every tab
    { id: 'all', content: t('c:all'), search: (prev) => ({ ...prev, statusTab: undefined }), activeOptions: { exact: true, includeSearch: true } },
    ...statusesBottomUp.map((status): StatusTab => {
      const { status: name, icon: Icon } = statusOptionsByValue[status];
      const count = counts?.[status] ?? 0;
      return {
        id: name,
        // The icon's title names the status, for the link's accessible name
        content: (
          <>
            <Icon className={cn('size-3.5 shrink-0', counts && !count && 'opacity-40')} />
            {counts && Math.min(count, 99)}
          </>
        ),
        search: (prev) => ({ ...prev, statusTab: name }),
        activeOptions: { exact: false, includeSearch: true },
      };
    }),
  ];

  return (
    <TabNavShell className="max-sm:border-t" indicator={indicator}>
      {tabs.map(({ id, content, search: tabSearch, activeOptions }, index) => (
        <Link
          key={id}
          id={`tab-${id}`}
          to="."
          resetScroll={false}
          draggable={false}
          className={cn(tabNavItemClass, 'min-w-10 px-0 last:mr-0')}
          data-active={!statuses && index === 0 ? true : undefined}
          search={tabSearch}
          activeOptions={activeOptions}
          activeProps={{ 'data-active': true }}
          onClick={scrollToResetOnNavigate}
        >
          {({ isActive }) => (
            <>
              <span className="group-active/tab:press flex items-center justify-center gap-0.5 text-sm tabular-nums">{content}</span>
              {(isActive || (!statuses && index === 0)) && <ActiveTabMarker indicator={indicator} />}
            </>
          )}
        </Link>
      ))}
    </TabNavShell>
  );
}
