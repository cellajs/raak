import { TagIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { foldText } from 'shared/utils/text-match';
import { useSearchParams } from '~/hooks/use-search-params';
import type { SearchFilters } from '~/modules/common/search-chips/types';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import type { EnrichedProject } from '~/modules/project/types';
import { type RecentBoardSearch, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import {
  boardSearchParts,
  isBoardSearchActive,
  isWorthRecalling,
  type ParsedBoardSearch,
  replaceFilterValue,
  toggleFilterValue,
} from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { useTaskListsSnapshot } from '~/modules/task/hooks/use-task-lists-snapshot';
import { publicTasksBoardQueryOptions } from '~/modules/task/public-query';
import { taskKeys } from '~/modules/task/query';
import { statusOptions } from '~/modules/task/task-properties';
import type { BoardSearchParams, Task } from '~/modules/task/types';

const noRecents: RecentBoardSearch[] = [];
const noCounts = { statuses: {}, types: {}, labels: {} };
const popularLabelCount = 12;

// Backlog and started, the statuses people filter on most, come near the start
const statusesToPick = [...statusOptions].reverse();

// Status colors are svg attributes, which any CSS outranks. A knockout takes the chip's own fill, or it would vanish into the shape around it.
const statusChipIconClass =
  '[&_[fill]:not([fill=none])]:fill-current [&_[stroke]:not([data-knockout])]:stroke-current [&_[data-knockout]]:stroke-foreground-soft';

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

/**
 * The status, type and label filters of the board search, and the recent searches of `channelId`, counted over the board's cached tasks; counts leave out `typingWord`, which a picked suggestion replaces.
 * Counting starts with `isFieldUsed` or a search in the URL: nothing else reads the counts.
 */
export function useBoardSearchFilters(
  channelId: string,
  projects: Pick<EnrichedProject, 'id' | 'organizationId'>[],
  typingWord: string,
  isFieldUsed: boolean,
  publicView?: boolean,
): SearchFilters {
  const { t } = useTranslation();
  const search = useBoardSearch();
  const foldedTypingWord = foldText(typingWord);
  const countedSearch = { ...search, terms: search.terms.filter((term) => term !== foldedTypingWord) };
  const {
    search: { q = '' },
    setSearch,
  } = useSearchParams<BoardSearchParams>();

  const recents = useTaskBoardStore((state) => state.recentSearches[channelId] ?? noRecents);
  const saveRecent = useTaskBoardStore((state) => state.saveRecentSearch);
  const removeRecent = useTaskBoardStore((state) => state.removeRecentSearch);

  const counted = useTaskListsSnapshot(
    projects.map(({ id, organizationId }) => (publicView ? publicTasksBoardQueryOptions(id).queryKey : taskKeys.list.home(organizationId, id))),
    isFieldUsed || isBoardSearchActive(search) ? JSON.stringify(countedSearch) : null,
    (tasks) => JSON.stringify(countOptions(tasks, countedSearch)),
  );
  const { statuses, types, labels }: ReturnType<typeof countOptions> = counted ? JSON.parse(counted) : noCounts;

  const statusName = (status: (typeof statusOptions)[number]['status']) => t(`c:${status}`);
  const write = (key: 'status' | 'type' | 'labels', value: string | undefined) => setSearch({ [key]: value });

  const typeSlugs = Object.keys(types).sort((a, b) => types[a].name.localeCompare(types[b].name));
  const labelSlugs = Object.keys(labels).sort((a, b) => labels[b].count - labels[a].count);

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
        onReplace: (from: string, to: string) => write('status', replaceFilterValue(search.statuses.join(','), from, to)),
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
        onReplace: (from: string, to: string) => write('type', replaceFilterValue(search.types.join(','), from, to)),
      },
      {
        key: 'labels',
        label: t('c:label_other'),
        isCompact: true,
        matchIcon: <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />,
        rowLimit: popularLabelCount,
        options: labelSlugs.map((slug) => ({
          value: slug,
          label: labels[slug].name,
          count: labels[slug].count,
          isSelected: search.labels.includes(slug),
        })),
        onToggle: (slug: string) => write('labels', toggleFilterValue(search.labels.join(','), slug)),
        onReplace: (from: string, to: string) => write('labels', replaceFilterValue(search.labels.join(','), from, to)),
      },
    ].filter((group) => group.options.length > 0),
    chips: [
      ...search.types.map((slug) => ({
        key: `type:${slug}`,
        group: 'type',
        value: slug,
        label: types[slug]?.name ?? slug,
        icon: types[slug] && <PrimaryLabelIcon label={types[slug]} className="text-current!" />,
        onRemove: () => write('type', toggleFilterValue(search.types.join(','), slug)),
      })),
      ...statusChips.map(({ status, icon: Icon }) => ({
        key: `status:${status}`,
        group: 'status',
        value: status,
        label: statusName(status),
        icon: <Icon className={statusChipIconClass} />,
        onRemove: () => write('status', toggleFilterValue(search.statuses.join(','), status)),
      })),
      ...search.labels.map((slug) => ({
        key: `labels:${slug}`,
        group: 'labels',
        value: slug,
        label: labels[slug]?.name ?? slug,
        onRemove: () => write('labels', toggleFilterValue(search.labels.join(','), slug)),
      })),
    ],
    recents: recents.map((recent) => ({
      key: JSON.stringify(recent),
      text: recent.q,
      chips: [
        ...recent.type.map((slug) => ({
          label: types[slug]?.name ?? slug,
          icon: types[slug] && <PrimaryLabelIcon label={types[slug]} />,
        })),
        ...statusesToPick.filter(({ status }) => recent.status.includes(status)).map(({ status }) => ({ label: statusName(status) })),
        ...recent.labels.map((slug) => ({ label: labels[slug]?.name ?? slug })),
      ],
      onPick: () =>
        setSearch({
          q: recent.q,
          status: recent.status.join(',') || undefined,
          type: recent.type.join(',') || undefined,
          labels: recent.labels.join(',') || undefined,
        }),
      onRemove: () => removeRecent(channelId, recent),
    })),
    onSearchEnd: (next) => {
      const recent = { q: next || q, status: search.statuses, type: search.types, labels: search.labels };
      if (isWorthRecalling(recent)) saveRecent(channelId, recent);
    },
  };
}
