import { useRouter } from '@tanstack/react-router';
import { TagIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { foldText } from 'shared/utils/text-match';
import { useSearchParams } from '~/hooks/use-search-params';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import type { SearchFilters } from '~/modules/common/search-chips/types';
import { PrimaryLabelIcon } from '~/modules/label/primary-label-icon';
import type { EnrichedProject } from '~/modules/project/types';
import { type RecentBoardSearch, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { subscribeToTaskCache } from '~/modules/task/helpers/active-task';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import {
  boardSearchParts,
  fitBoardSearch,
  isBoardSearchActive,
  isWorthRecalling,
  noAssignee,
  type ParsedBoardSearch,
  replaceFilterValue,
  toggleFilterValue,
} from '~/modules/task/helpers/search-filter';
import { useBoardSearch } from '~/modules/task/hooks/use-board-search';
import { useTaskListsSnapshot } from '~/modules/task/hooks/use-task-lists-snapshot';
import { NoAssigneeAvatar } from '~/modules/task/no-assignee-avatar';
import { publicTasksBoardQueryOptions } from '~/modules/task/public-query';
import { taskKeys } from '~/modules/task/query';
import { boardFilterList } from '~/modules/task/search-params-schemas';
import { statusOptions } from '~/modules/task/task-properties';
import type { BoardSearchParams, Task } from '~/modules/task/types';
import { useUserStore } from '~/modules/user/user-store';
import { isQueryData } from '~/query/basic/mutate-query';
import { queryClient } from '~/query/query-client';
import { cn } from '~/utils/cn';

const noRecents: RecentBoardSearch[] = [];
const noCounts = { statuses: {}, types: {}, labels: {}, assignees: {} };
const popularLabelCount = 12;

// Backlog and started, the statuses people filter on most, come near the start
const statusesToPick = [...statusOptions].reverse();

// Status colors are svg attributes, which any CSS outranks.
const statusChipIconClass = '[&_[fill]:not([fill=none])]:fill-current [&_[stroke]]:stroke-current';

interface CountedLabel {
  name: string;
  icon?: string | null;
  color?: string | null;
  count: number;
}

interface CountedAssignee {
  name: string;
  thumbnailUrl?: string | null;
  count: number;
}

const unassigned = [{ id: noAssignee, name: '', thumbnailUrl: null }];

const boardListKeys = (projects: Pick<EnrichedProject, 'id' | 'organizationId'>[], publicView?: boolean) =>
  projects.map(({ id, organizationId }) => (publicView ? publicTasksBoardQueryOptions(id).queryKey : taskKeys.list.home(organizationId, id)));

/** What each option would show: a filter's own values leave that filter out, so one adds to what it shows. */
const countOptions = (tasks: Task[], search: ParsedBoardSearch) => {
  const statuses: Record<string, number> = {};
  const types: Record<string, CountedLabel> = {};
  const labels: Record<string, CountedLabel> = {};
  const assignees: Record<string, CountedAssignee> = {};

  for (const task of tasks) {
    if (isDraftTask(task)) continue;
    const parts = boardSearchParts(search, task);

    if (parts.words && parts.type && parts.labels && parts.assigned) {
      const name = statusOptions.find((option) => option.value === task.status)?.status;
      if (name) statuses[name] = (statuses[name] ?? 0) + 1;
    }
    if (task.primaryLabel) {
      const { slug, name, icon, color } = task.primaryLabel;
      const entry = types[slug] ?? { name, icon, color, count: 0 };
      if (parts.words && parts.status && parts.labels && parts.assigned) entry.count += 1;
      types[slug] = entry;
    }
    for (const { slug, name } of task.labels) {
      const entry = labels[slug] ?? { name, count: 0 };
      if (parts.words && parts.status && parts.type && parts.assigned) entry.count += 1;
      labels[slug] = entry;
    }
    for (const { id, name, thumbnailUrl } of task.assignedTo.length ? task.assignedTo : unassigned) {
      const entry = assignees[id] ?? { name, thumbnailUrl, count: 0 };
      if (parts.words && parts.status && parts.type && parts.labels) entry.count += 1;
      assignees[id] = entry;
    }
  }
  return { statuses, types, labels, assignees };
};

/**
 * The status, type, assignee and label filters of the board search, and the recent searches of `channelId`, counted over the board's cached tasks; counts leave out `typingWord`, which a picked suggestion replaces.
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
  const currentUserId = useUserStore((state) => state.user?.id);

  const counted = useTaskListsSnapshot(
    boardListKeys(projects, publicView),
    isFieldUsed || isBoardSearchActive(search) ? JSON.stringify(countedSearch) : null,
    (tasks) => JSON.stringify(countOptions(tasks, countedSearch)),
  );
  const { statuses, types, labels, assignees }: ReturnType<typeof countOptions> = counted ? JSON.parse(counted) : noCounts;

  const statusName = (name: (typeof statusOptions)[number]['name']) => t(`c:${name}`);
  const write = (key: 'status' | 'type' | 'labels' | 'assigned', values: string[]) => setSearch({ [key]: values });

  const typeSlugs = Object.keys(types).sort((a, b) => types[a].name.localeCompare(types[b].name));
  const labelSlugs = Object.keys(labels).sort((a, b) => labels[b].count - labels[a].count);

  const assigneeRank = (id: string) => (id === currentUserId ? 0 : id === noAssignee ? 2 : 1);
  const assigneeIds = Object.keys(assignees).sort((a, b) => assigneeRank(a) - assigneeRank(b) || assignees[b].count - assignees[a].count);
  const assigneeName = (id: string) => {
    if (id === currentUserId) return t('c:you');
    if (id === noAssignee) return t('c:no_one');
    return assignees[id]?.name.split(' ')[0] ?? t('c:member');
  };
  const assigneeIcon = (id: string, className?: string) =>
    id === noAssignee ? (
      <NoAssigneeAvatar aria-hidden className={cn('shrink-0', className)} />
    ) : (
      <EntityAvatar
        aria-hidden
        type="user"
        id={id}
        name={assignees[id]?.name}
        url={assignees[id]?.thumbnailUrl}
        className={cn('shrink-0', className)}
      />
    );

  const statusChips = statusesToPick.filter(({ status }) => search.statuses.includes(status));

  return {
    groups: [
      {
        key: 'assigned',
        isUnlabeled: true,
        label: t('c:assigned_to'),
        isIconOnly: true,
        options: assigneeIds.map((id) => ({
          value: id,
          label: assigneeName(id),
          icon: assigneeIcon(id, 'size-5'),
          count: assignees[id].count,
          isSelected: search.assignees.includes(id),
        })),
        onToggle: (id: string) => write('assigned', toggleFilterValue(search.assignees, id)),
        onReplace: (from: string, to: string) => write('assigned', replaceFilterValue(search.assignees, from, to)),
      },
      {
        key: 'status',
        isUnlabeled: true,
        label: t('c:status'),
        options: statusesToPick.map(({ status, name, icon: Icon }) => ({
          value: status,
          label: statusName(name),
          icon: <Icon className="size-3.5 shrink-0" />,
          count: statuses[status] ?? 0,
          isSelected: search.statuses.includes(status),
        })),
        onToggle: (status: string) => write('status', toggleFilterValue(search.statuses, status)),
        onReplace: (from: string, to: string) => write('status', replaceFilterValue(search.statuses, from, to)),
      },
      {
        key: 'type',
        isUnlabeled: true,
        label: t('c:type'),
        options: typeSlugs.map((slug) => ({
          value: slug,
          label: types[slug].name,
          icon: <PrimaryLabelIcon label={types[slug]} className="size-3.5" />,
          count: types[slug].count,
          isSelected: search.types.includes(slug),
        })),
        onToggle: (slug: string) => write('type', toggleFilterValue(search.types, slug)),
        onReplace: (from: string, to: string) => write('type', replaceFilterValue(search.types, from, to)),
      },
      {
        key: 'labels',
        isUnlabeled: true,
        label: t('c:label_other'),
        isCompact: true,
        matchIcon: <TagIcon className="text-muted-foreground size-3.5 shrink-0" />,
        rowLimit: popularLabelCount,
        options: labelSlugs.map((slug) => ({
          value: slug,
          label: labels[slug].name,
          count: labels[slug].count,
          isSelected: search.labels.includes(slug),
        })),
        onToggle: (slug: string) => write('labels', toggleFilterValue(search.labels, slug)),
        onReplace: (from: string, to: string) => write('labels', replaceFilterValue(search.labels, from, to)),
      },
    ].filter((group) => group.options.length > 0),
    chips: [
      ...search.types.map((slug) => ({
        key: `type:${slug}`,
        group: 'type',
        value: slug,
        label: types[slug]?.name ?? slug,
        icon: types[slug] && <PrimaryLabelIcon label={types[slug]} className="text-current!" />,
        onRemove: () => write('type', toggleFilterValue(search.types, slug)),
      })),
      ...statusChips.map(({ status, name, icon: Icon }) => ({
        key: `status:${status}`,
        group: 'status',
        value: status,
        label: statusName(name),
        icon: <Icon className={statusChipIconClass} />,
        onRemove: () => write('status', toggleFilterValue(search.statuses, status)),
      })),
      ...search.assignees.map((id) => ({
        key: `assigned:${id}`,
        group: 'assigned',
        value: id,
        label: assigneeName(id),
        start: assigneeIcon(id),
        onRemove: () => write('assigned', toggleFilterValue(search.assignees, id)),
      })),
      ...search.labels.map((slug) => ({
        key: `labels:${slug}`,
        group: 'labels',
        value: slug,
        label: labels[slug]?.name ?? slug,
        onRemove: () => write('labels', toggleFilterValue(search.labels, slug)),
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
        ...statusesToPick.filter(({ status }) => recent.status.includes(status)).map(({ name }) => ({ label: statusName(name) })),
        ...recent.assigned.map((id) => ({ label: assigneeName(id), icon: assigneeIcon(id, 'size-4.5') })),
        ...recent.labels.map((slug) => ({ label: labels[slug]?.name ?? slug })),
      ],
      onPick: () => setSearch({ q: recent.q, status: recent.status, type: recent.type, labels: recent.labels, assigned: recent.assigned }),
      onRemove: () => removeRecent(channelId, recent),
    })),
    onSearchEnd: (next) => {
      const recent = { q: next || q, status: search.statuses, type: search.types, labels: search.labels, assigned: search.assignees };
      if (isWorthRecalling(recent)) saveRecent(channelId, recent);
    },
  };
}

/** Once per scope, when its task lists are cached, drops the filter values none of its tasks carry: a phone's project tab carries the search over, and a link can be old. */
export function useFitBoardSearch(scopeId: string, projects: Pick<EnrichedProject, 'id' | 'organizationId'>[], publicView?: boolean) {
  const router = useRouter();
  const userId = useUserStore((state) => state.user?.id);
  const listKeys = boardListKeys(projects, publicView);
  // No projects yet is not an empty scope: fitting to it would drop every filter
  const isCached = useSyncExternalStore(
    subscribeToTaskCache,
    () => listKeys.length > 0 && listKeys.every((key) => queryClient.getQueryData(key) !== undefined),
  );
  const fittedScopeRef = useRef<string | null>(null);

  const fitToScope = useEffectEvent(() => {
    const tasks = listKeys.flatMap((key) => {
      const data = queryClient.getQueryData(key);
      return isQueryData<Task>(data) ? data.items : [];
    });
    const { search } = router.state.location;
    const current = {
      type: boardFilterList.parse(search.type),
      labels: boardFilterList.parse(search.labels),
      assigned: boardFilterList.parse(search.assigned),
    };
    const fitted = fitBoardSearch(current, tasks, userId);
    // Fitting only drops values, so an unchanged length is an unchanged filter
    if (
      fitted.type.length === current.type.length &&
      fitted.labels.length === current.labels.length &&
      fitted.assigned.length === current.assigned.length
    )
      return;
    router.navigate({ to: '.', replace: true, resetScroll: false, search: (prev) => ({ ...prev, ...fitted }) });
  });

  // Not again within a scope: a filter whose last task changes while in view stays put
  useEffect(() => {
    if (!isCached || fittedScopeRef.current === scopeId) return;
    fittedScopeRef.current = scopeId;
    fitToScope();
  }, [isCached, scopeId]);
}
