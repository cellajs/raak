import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import type { SearchFilters } from '~/modules/common/search-chips-field';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import { useNavigationStore } from '~/modules/navigation/navigation-store';
import type { EnrichedProject } from '~/modules/project/types';
import { subscribeToTaskCache } from '~/modules/task/helpers/active-task';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { boardSearchParts, type ParsedBoardSearch, toggleFilterValue } from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { publicTasksBoardQueryOptions } from '~/modules/task/public-query';
import { taskKeys } from '~/modules/task/query';
import { statusOptions } from '~/modules/task/task-properties';
import type { BoardSearchParams, Task } from '~/modules/task/types';
import { isQueryData } from '~/query/basic/mutate-query';
import { queryClient } from '~/query/query-client';
import type { RecentListSearch } from '~/utils/recent-searches';

const recentsKey = 'task-board';
const noRecents: RecentListSearch[] = [];
const popularLabelCount = 12;

// Backlog and started, the statuses people filter on most, come near the start
const statusesToPick = [...statusOptions].reverse();

interface CountedLabel {
  name: string;
  icon?: string | null;
  color?: string | null;
  count: number;
}

/** What each option would show: a filter's own values leave that filter out, so one adds to what it shows. */
const countOptions = (tasks: Task[], search: ParsedBoardSearch) => {
  const statuses: Record<string, number> = {};
  const types: Record<string, CountedLabel> = {};
  const labels: Record<string, CountedLabel> = {};

  for (const task of tasks) {
    if (isDraftTask(task)) continue;
    const parts = boardSearchParts(search, task);

    if (parts.words && parts.type && parts.labels) {
      const name = statusOptions.find((option) => option.value === task.status)?.status;
      if (name) statuses[name] = (statuses[name] ?? 0) + 1;
    }
    if (task.primaryLabel) {
      const { slug, name, icon, color } = task.primaryLabel;
      const entry = types[slug] ?? { name, icon, color, count: 0 };
      if (parts.words && parts.status && parts.labels) entry.count += 1;
      types[slug] = entry;
    }
    for (const { slug, name } of task.labels) {
      const entry = labels[slug] ?? { name, count: 0 };
      if (parts.words && parts.status && parts.type) entry.count += 1;
      labels[slug] = entry;
    }
  }
  return { statuses, types, labels };
};

/** The status, type and label filters of the board search, and its recent searches, counted over the board's cached tasks. */
export function useBoardSearchFilters(projects: Pick<EnrichedProject, 'id' | 'organizationId'>[], publicView?: boolean): SearchFilters {
  const { t } = useTranslation();
  const search = useBoardSearch();
  const {
    search: { q = '' },
    setSearch,
  } = useSearchParams<BoardSearchParams>();

  const recents = useNavigationStore((state) => state.recentListSearches[recentsKey] ?? noRecents);
  const saveRecent = useNavigationStore((state) => state.saveRecentListSearch);
  const removeRecent = useNavigationStore((state) => state.removeRecentListSearch);

  // Joined into one string: useSyncExternalStore compares snapshots by value
  const counted = useSyncExternalStore(subscribeToTaskCache, () => {
    const tasks = projects.flatMap(({ id, organizationId }) => {
      const queryKey = publicView ? publicTasksBoardQueryOptions(id).queryKey : taskKeys.list.home(organizationId, id);
      const data = queryClient.getQueryData(queryKey);
      return isQueryData<Task>(data) ? data.items : [];
    });
    return JSON.stringify(countOptions(tasks, search));
  });
  const { statuses, types, labels }: ReturnType<typeof countOptions> = JSON.parse(counted);

  const statusName = (status: (typeof statusOptions)[number]['status']) => t(`c:${status}`);
  const write = (key: 'status' | 'type' | 'labels', value: string | undefined) => setSearch({ [key]: value });

  const typeSlugs = Object.keys(types).sort((a, b) => types[a].name.localeCompare(types[b].name));
  const labelSlugs = Object.keys(labels)
    .sort((a, b) => labels[b].count - labels[a].count)
    .filter((slug, index) => index < popularLabelCount || search.labels.includes(slug));

  const statusChips = statusesToPick.filter(({ status }) => search.statuses.includes(status));

  return {
    groups: [
      {
        key: 'status',
        label: t('c:status'),
        options: statusesToPick.map(({ status, icon: Icon }) => ({
          value: status,
          label: statusName(status),
          icon: <Icon className="size-3.5 shrink-0" />,
          count: statuses[status] ?? 0,
          isSelected: search.statuses.includes(status),
        })),
        onToggle: (status: string) => write('status', toggleFilterValue(search.statuses.join(','), status)),
      },
      {
        key: 'type',
        label: t('c:type'),
        options: typeSlugs.map((slug) => ({
          value: slug,
          label: types[slug].name,
          icon: <PrimaryLabelIcon label={types[slug]} className="size-3.5" />,
          count: types[slug].count,
          isSelected: search.types.includes(slug),
        })),
        onToggle: (slug: string) => write('type', toggleFilterValue(search.types.join(','), slug)),
      },
      {
        key: 'labels',
        label: t('c:label_other'),
        isCompact: true,
        options: labelSlugs.map((slug) => ({
          value: slug,
          label: labels[slug].name,
          count: labels[slug].count,
          isSelected: search.labels.includes(slug),
        })),
        onToggle: (slug: string) => write('labels', toggleFilterValue(search.labels.join(','), slug)),
      },
    ].filter((group) => group.options.length > 0),
    chips: [
      ...search.types.map((slug) => ({
        key: `type:${slug}`,
        label: types[slug]?.name ?? slug,
        icon: types[slug] && <PrimaryLabelIcon label={types[slug]} className="text-current!" />,
        onRemove: () => write('type', toggleFilterValue(search.types.join(','), slug)),
      })),
      ...statusChips.map(({ status }) => ({
        key: `status:${status}`,
        label: statusName(status),
        onRemove: () => write('status', toggleFilterValue(search.statuses.join(','), status)),
      })),
      ...search.labels.map((slug) => ({
        key: `labels:${slug}`,
        label: labels[slug]?.name ?? slug,
        onRemove: () => write('labels', toggleFilterValue(search.labels.join(','), slug)),
      })),
    ],
    recents: recents.map((recent) => ({
      key: JSON.stringify(recent),
      text: recent.q,
      chips: [
        ...(recent.filters.type ?? []).map((slug) => ({
          label: types[slug]?.name ?? slug,
          icon: types[slug] && <PrimaryLabelIcon label={types[slug]} />,
        })),
        ...statusesToPick.filter(({ status }) => recent.filters.status?.includes(status)).map(({ status }) => ({ label: statusName(status) })),
        ...(recent.filters.labels ?? []).map((slug) => ({ label: labels[slug]?.name ?? slug })),
      ],
      onPick: () =>
        setSearch({
          q: recent.q,
          status: recent.filters.status?.join(',') || undefined,
          type: recent.filters.type?.join(',') || undefined,
          labels: recent.filters.labels?.join(',') || undefined,
        }),
      onRemove: () => removeRecent(recentsKey, recent),
    })),
    onSearchEnd: (next) => saveRecent(recentsKey, { q: next || q, filters: { status: search.statuses, type: search.types, labels: search.labels } }),
  };
}
