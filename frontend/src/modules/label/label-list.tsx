import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { BirdIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useSearchParams } from '~/hooks/use-search-params';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { searchHighlightRowClass } from '~/modules/common/search-highlight';
import { Spinner } from '~/modules/common/spinner';
import { groupLabelRows } from '~/modules/label/group-labels';
import { LabelFilterButton } from '~/modules/label/label-filter';
import { type Label, labelsCanonicalOptions } from '~/modules/label/query';
import type { LabelRow, LabelsScope, LabelsScopeProps } from '~/modules/label/types';
import { findProjectByIdOrSlug, projectsListQueryOptions } from '~/modules/project/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { Badge } from '~/modules/ui/badge';
import { Checkbox } from '~/modules/ui/checkbox';
import { ScrollArea } from '~/modules/ui/scroll-area';
import { cn } from '~/utils/cn';

/** Highlight-mode match over the same columns the server search filters on (name + keywords). */
const matchesSearch = (row: LabelRow, words: string[]) =>
  words.every((word) => row.nameLower.includes(word) || row.keywordsLower.includes(word));

/** The panel lists secondary tags and epics; primary labels live on the task cards, not here. */
const isPanelLabel = (mode: string) => mode !== 'primary';

/** Split a search query into lowercase words for client-side filtering/highlighting. */
const toWords = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

// Module-scoped so its identity is stable: useQueries returns a fresh combined value each render
// unless the combine function is referentially stable (mirrors the label picker, select-labels).
const combinePanelLabels = (results: { data?: { items: Label[] }; isLoading: boolean }[]) => ({
  labels: results.flatMap((r) => r.data?.items ?? []).filter((label) => isPanelLabel(label.mode)),
  pending: results.some((r) => r.isLoading),
});

type LabelListScopeProps = { entityId: string; windowScroll?: boolean };

/** Newest-first by creation, mirroring the tasks table's default order. */
const byCreatedAtDesc = (a: LabelRow, b: LabelRow) =>
  a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;

/** Group labels into rows and sort newest-first, then filter (or, in highlight mode, keep all and tint later). */
const useLabelRows = (labels: Label[], highlight: boolean, words: string[]) =>
  useMemo(() => {
    const grouped = groupLabelRows(labels).sort(byCreatedAtDesc);
    if (highlight || !words.length) return grouped;
    return grouped.filter((row) => matchesSearch(row, words));
  }, [labels, highlight, words]);

/**
 * Project scope reads the canonical per-project list (the same key the optimistic create splices
 * into, mirroring the task board), then filters modes/search client-side. That keeps a label a
 * user just created visible immediately in the tab that created it, without a refetch.
 */
const ProjectLabelList = ({ entityId, windowScroll }: LabelListScopeProps) => {
  const { organization, tenantId } = useOrganizationLayoutContext();
  const { search } = useSearchParams<{ q?: string }>({});
  const { highlight, effectiveQ } = parseSearchQuery(search.q);

  const { data, isLoading } = useQuery({
    ...labelsCanonicalOptions({ organizationId: organization.id, tenantId, projectId: entityId }),
    select: (result) => result.items.filter((label) => isPanelLabel(label.mode)),
  });

  const words = useMemo(() => toWords(effectiveQ), [effectiveQ]);
  const rows = useLabelRows(data ?? [], highlight, words);

  return (
    <LabelListView
      entity="project"
      rows={rows}
      isLoading={isLoading}
      highlight={highlight}
      highlightWords={highlight ? words : []}
      windowScroll={windowScroll}
    />
  );
};

/**
 * Workspace scope aggregates labels across the workspace's projects. Labels are project-homed, so it
 * reads each project's canonical home list (the keys the optimistic create splices into) via
 * useQueries and groups client-side, mirroring the label picker (select-labels). A just-created
 * label therefore shows immediately in the creating tab here too.
 */
const WorkspaceLabelList = ({ entityId, windowScroll }: LabelListScopeProps) => {
  const { organization, tenantId } = useOrganizationLayoutContext();
  const { search } = useSearchParams<{ q?: string }>({});
  const { highlight, effectiveQ } = parseSearchQuery(search.q);

  const { data: projectIds } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: entityId }),
    select: (data) => data.pages.flatMap((page) => page.items.map((p) => p.id)),
  });

  const { labels, pending } = useQueries({
    queries: (projectIds ?? []).map((pid) =>
      labelsCanonicalOptions({ organizationId: organization.id, tenantId, projectId: pid }),
    ),
    combine: combinePanelLabels,
  });
  const isLoading = projectIds === undefined || pending;

  const words = useMemo(() => toWords(effectiveQ), [effectiveQ]);
  const rows = useLabelRows(labels, highlight, words);

  return (
    <LabelListView
      entity="workspace"
      rows={rows}
      isLoading={isLoading}
      highlight={highlight}
      highlightWords={highlight ? words : []}
      windowScroll={windowScroll}
    />
  );
};

type LabelListViewProps = {
  entity: LabelsScope;
  rows: LabelRow[];
  isLoading: boolean;
  highlight: boolean;
  highlightWords: string[];
  windowScroll?: boolean;
};

/**
 * Tile list for the labels panel (secondary tags + epics), styled after the task panel's
 * list body: semantic ul/li rows, scrolled internally or by the page (windowScroll). Each
 * tile leads with a select checkbox (task-card style); the rest of the tile opens the label
 * page via a stretched link. The shared board search filters it; a '=' query highlights
 * matches instead of filtering.
 */
const LabelListView = ({ entity, rows, isLoading, highlight, highlightWords, windowScroll }: LabelListViewProps) => {
  const { t } = useTranslation();
  const { tenantId } = useOrganizationLayoutContext();

  const selectedLabelIds = useTaskInteractionStore((s) => s.selectedLabelIds);
  const setSelectedLabelIds = useTaskInteractionStore((s) => s.setSelectedLabelIds);
  // Task and label selection are mutually exclusive so the shared remove button targets one kind
  const hasSelectedTasks = useTaskInteractionStore((s) => s.selectedTaskIds.length > 0);

  const handleLabelSelect = (checked: boolean, row: LabelRow) => {
    if (checked) setSelectedLabelIds([...selectedLabelIds, row.id]);
    else setSelectedLabelIds(selectedLabelIds.filter((id) => id !== row.id));
  };

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

  const body = (
    <ul aria-label={t('c:label_other')}>
      {rows.map((row) => (
        <li
          key={row.id}
          className={cn(
            'group/labelTile relative flex w-full items-center gap-2 border-b px-3 py-2.5 text-sm focus-within:bg-accent/30 hover:bg-accent/30',
            highlight && matchesSearch(row, highlightWords) && searchHighlightRowClass,
          )}
        >
          <Checkbox
            className="relative z-10 border-foreground/40 opacity-80 group-hover/labelTile:opacity-100 data-[state=checked]:border-primary"
            checked={selectedLabelIds.includes(row.id)}
            disabled={hasSelectedTasks}
            aria-label={row.name}
            onCheckedChange={(checked) => handleLabelSelect(checked === true, row)}
          />
          {/* Stretched link: the after-overlay makes the whole tile open the label page,
              while the checkbox and filter button sit above it on their own layer */}
          <Link
            to="."
            replace={false}
            resetScroll={false}
            search={(prev) => ({ ...prev, labelPageId: row.id })}
            className="flex min-w-0 grow items-center gap-2 text-left outline-0 ring-0 after:absolute after:inset-0 after:content-['']"
          >
            <span className="grow truncate opacity-80 group-focus-within/labelTile:opacity-100 group-hover/labelTile:opacity-100">
              {row.name}
            </span>
            {row.mode === 'epic' && <Badge variant="secondary">{t('c:epic')}</Badge>}
          </Link>
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
          <LabelFilterButton name={row.name} size="xs" tabIndex={-1} className="relative z-10" />
        </li>
      ))}
    </ul>
  );

  // With windowScroll the panel grows with content and the page scrolls; otherwise scroll internally
  if (windowScroll) return <div className="flex-1">{body}</div>;
  return <ScrollArea className="min-h-0 flex-1">{body}</ScrollArea>;
};

/** Labels panel body: canonical per-project list at project scope, aggregated list at workspace scope. */
export const LabelList = ({ entity, entityId, windowScroll }: LabelsScopeProps & { windowScroll?: boolean }) =>
  entity === 'workspace' ? (
    <WorkspaceLabelList entityId={entityId} windowScroll={windowScroll} />
  ) : (
    <ProjectLabelList entityId={entityId} windowScroll={windowScroll} />
  );
