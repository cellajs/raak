import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { BirdIcon } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { matchesTerms } from 'shared/utils/text-match';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { ListFocusScope } from '~/modules/board-focus/list-focus-scope';
import { firstItemInView, registerPanelNav } from '~/modules/board-focus/panel-nav-registry';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { Spinner } from '~/modules/common/spinner';
import { groupLabelRows } from '~/modules/label/group-labels';
import { LabelTile } from '~/modules/label/label-tile';
import { labelTileDomId, useLabelTileStore } from '~/modules/label/label-tile-store';
import { type Label, labelsCanonicalOptions } from '~/modules/label/query';
import type { LabelRow, LabelsHostProps, LabelsScopeProps } from '~/modules/label/types';
import { type LabelUsage, useLabelUsage } from '~/modules/label/use-label-usage';
import { projectsListQueryOptions } from '~/modules/project/query';
import { ScrollArea } from '~/modules/ui/scroll-area';

/** Highlight-mode match over the same columns the server search filters on (name + keywords). */
const matchesSearch = (row: LabelRow, terms: string[]) => matchesTerms([row.nameFolded, row.keywordsFolded], terms);

/** The panel lists secondary tags and epics; primary labels live on the task cards, not here. */
const isPanelLabel = (mode: string) => mode !== 'primary';

// Module-scoped so its identity is stable: useQueries returns a fresh combined value each render
// unless the combine function is referentially stable (mirrors the label picker, select-labels).
const combinePanelLabels = (results: { data?: { items: Label[] }; isLoading: boolean }[]) => ({
  labels: results.flatMap((r) => r.data?.items ?? []).filter((label) => isPanelLabel(label.mode)),
  pending: results.some((r) => r.isLoading),
});

type LabelListScopeProps = { entityId: string } & LabelsHostProps;

/** Newest-first by creation, mirroring the tasks table's default order. */
const byCreatedAtDesc = (a: LabelRow, b: LabelRow) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

/** Group labels into rows and sort newest-first, then filter (or, in highlight mode, keep all and tint later). */
const useLabelRows = (labels: Label[], usage: LabelUsage, highlight: boolean, words: string[]) =>
  useMemo(() => {
    const grouped = groupLabelRows(labels, { usage }).sort(byCreatedAtDesc);
    if (highlight || !words.length) return grouped;
    return grouped.filter((row) => matchesSearch(row, words));
  }, [labels, usage, highlight, words]);

/**
 * Project scope reads the canonical per-project list (the same key the optimistic create splices
 * into, mirroring the task board), then filters modes/search client-side. That keeps a label a
 * user just created visible immediately in the tab that created it, without a refetch.
 */
function ProjectLabelList({ entityId, ...hostProps }: LabelListScopeProps) {
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const q = useSearch({ strict: false, select: (search) => search.q });
  const { highlight, terms } = parseSearchQuery(q);

  const { data, isLoading } = useQuery({
    ...labelsCanonicalOptions({ organizationId, tenantId, projectId: entityId }),
    select: (result) => result.items.filter((label) => isPanelLabel(label.mode)),
  });
  const usage = useLabelUsage([entityId]);

  const rows = useLabelRows(data ?? [], usage, highlight, terms);

  return <LabelListView rows={rows} isLoading={isLoading} highlight={highlight} highlightWords={highlight ? terms : []} {...hostProps} />;
}

/**
 * Workspace scope aggregates labels across the workspace's projects. Labels are project-homed, so it
 * reads each project's canonical home list (the keys the optimistic create splices into) via
 * useQueries and groups client-side, mirroring the label picker (select-labels). A just-created
 * label therefore shows immediately in the creating tab here too.
 */
function WorkspaceLabelList({ entityId, ...hostProps }: LabelListScopeProps) {
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const q = useSearch({ strict: false, select: (search) => search.q });
  const { highlight, terms } = parseSearchQuery(q);

  const { data: projectIds } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: entityId }),
    select: (data) => data.pages.flatMap((page) => page.items.map((p) => p.id)),
  });

  const { labels, pending } = useQueries({
    queries: (projectIds ?? []).map((pid) => labelsCanonicalOptions({ organizationId, tenantId, projectId: pid })),
    combine: combinePanelLabels,
  });
  const usage = useLabelUsage(projectIds ?? []);
  const isLoading = projectIds === undefined || pending;

  const rows = useLabelRows(labels, usage, highlight, terms);

  return <LabelListView rows={rows} isLoading={isLoading} highlight={highlight} highlightWords={highlight ? terms : []} {...hostProps} />;
}

type LabelListViewProps = {
  rows: LabelRow[];
  isLoading: boolean;
  highlight: boolean;
  highlightWords: string[];
} & LabelsHostProps;

/**
 * Renders label tiles using internal or page scrolling.
 * Standard searches filter rows; '=' queries highlight matches.
 */
function LabelListView({ rows, isLoading, highlight, highlightWords, windowScroll, navPanelId, ...tileProps }: LabelListViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const labelPageId = useSearch({ strict: false, select: (search) => search.labelPageId });

  const viewportRef = useRef<HTMLDivElement>(null);
  const itemIds = useMemo(() => rows.map((row) => labelTileDomId(row.id)), [rows]);
  const itemIdsRef = useRef(itemIds);
  itemIdsRef.current = itemIds;

  // Every tile is mounted, so bringing one into view is a plain scroll
  useEffect(() => {
    if (!navPanelId) return;
    return registerPanelNav(navPanelId, {
      items: () => itemIdsRef.current.map((id) => ({ id })),
      scrollTo: (id) => document.getElementById(id)?.scrollIntoView({ block: 'nearest' }),
      firstInView: () => firstItemInView(itemIdsRef.current, viewportRef.current),
    });
  }, [navPanelId]);

  // A label link opens its tile once, then leaves the URL: closing the tile must not leave a stale link behind
  useEffect(() => {
    if (!labelPageId || isLoading) return;
    const row = rows.find((candidate) => candidate.siblingIds.includes(labelPageId));
    if (row) {
      useLabelTileStore.getState().expand(row.id, tileProps.singleExpand);
      requestAnimationFrame(() => document.getElementById(labelTileDomId(row.id))?.scrollIntoView({ block: 'nearest' }));
    }
    navigate({ to: '.', replace: true, resetScroll: false, search: (prev) => ({ ...prev, labelPageId: undefined }) });
  }, [labelPageId, isLoading]);

  if (isLoading) return <Spinner className="my-8" />;
  if (!rows.length) {
    return <ContentPlaceholder icon={BirdIcon} title="c:no_resource_yet" titleProps={{ resource: t('c:label_other').toLowerCase() }} />;
  }

  const list = (
    <ul aria-label={t('c:label_other')}>
      {rows.map((row) => (
        <LabelTile key={row.id} row={row} highlighted={highlight && matchesSearch(row, highlightWords)} onBoard={!!navPanelId} {...tileProps} />
      ))}
    </ul>
  );
  const body = navPanelId ? (
    <ListFocusScope itemIds={itemIds} viewportRef={viewportRef}>
      {list}
    </ListFocusScope>
  ) : (
    list
  );

  // With windowScroll the panel grows with content and the page scrolls; otherwise scroll internally
  if (windowScroll) return <div className="flex-1">{body}</div>;
  return (
    <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
      {body}
    </ScrollArea>
  );
}

/** Labels panel body: canonical per-project list at project scope, aggregated list at workspace scope. */
export function LabelList({ entity, entityId, ...hostProps }: LabelsScopeProps & LabelsHostProps) {
  return entity === 'workspace' ? <WorkspaceLabelList entityId={entityId} {...hostProps} /> : <ProjectLabelList entityId={entityId} {...hostProps} />;
}
