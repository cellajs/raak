import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { BirdIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Label } from 'sdk';
import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { matchesTerms } from 'shared/utils/text-match';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { ListFocusScope } from '~/modules/board-focus/list-focus-scope';
import { firstItemInView, registerPanelNav } from '~/modules/board-focus/panel-nav-registry';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { Spinner } from '~/modules/common/spinner';
import { groupLabelRows } from '~/modules/label/group-labels';
import { LabelTile, labelTileDomId } from '~/modules/label/label-tile';
import { labelTileStore } from '~/modules/label/label-tile-store';
import { labelsCanonicalOptions } from '~/modules/label/query';
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
  labels: results.flatMap((result) => result.data?.items ?? []).filter((label) => isPanelLabel(label.mode)),
  pending: results.some((result) => result.isLoading),
});

interface LabelListScopeProps extends LabelsHostProps {
  entityId: string;
}

/** Newest-first by creation, mirroring the tasks table's default order. */
const byCreatedAtDesc = (a: LabelRow, b: LabelRow) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);

/**
 * Project scope reads the canonical per-project list (the same key the optimistic create splices
 * into, mirroring the task board), then filters modes/search client-side. That keeps a label a
 * user just created visible immediately in the tab that created it, without a refetch.
 */
function ProjectLabelList({ entityId, ...hostProps }: LabelListScopeProps) {
  const { organizationId, tenantId } = useOrganizationLayoutContext();

  const { data, isLoading } = useQuery({
    ...labelsCanonicalOptions({ organizationId, tenantId, projectId: entityId }),
    select: (result) => result.items.filter((label) => isPanelLabel(label.mode)),
  });
  const usage = useLabelUsage([entityId]);

  return <LabelListView labels={data ?? []} usage={usage} isLoading={isLoading} {...hostProps} />;
}

/**
 * Workspace scope aggregates labels across the workspace's projects. Labels are project-homed, so it
 * reads each project's canonical home list (the keys the optimistic create splices into) via
 * useQueries and groups client-side, mirroring the label picker (select-labels). A just-created
 * label therefore shows immediately in the creating tab here too.
 */
function WorkspaceLabelList({ entityId, ...hostProps }: LabelListScopeProps) {
  const { organizationId, tenantId } = useOrganizationLayoutContext();

  const { data: projectIds } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: entityId }),
    select: (data) => data.pages.flatMap((page) => page.items.map((project) => project.id)),
  });

  const { labels, pending } = useQueries({
    queries: (projectIds ?? []).map((projectId) => labelsCanonicalOptions({ organizationId, tenantId, projectId })),
    combine: combinePanelLabels,
  });
  const usage = useLabelUsage(projectIds ?? []);

  return <LabelListView labels={labels} usage={usage} isLoading={projectIds === undefined || pending} {...hostProps} />;
}

interface LabelListViewProps extends LabelsHostProps {
  labels: Label[];
  usage: LabelUsage;
  isLoading: boolean;
}

/**
 * Renders label tiles using internal or page scrolling.
 * Standard searches filter rows; '=' queries highlight matches.
 */
function LabelListView({ labels, usage, isLoading, windowScroll, navPanelId, ...tileProps }: LabelListViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const q = useSearch({ strict: false, select: (search) => search.q });
  const labelPageId = useSearch({ strict: false, select: (search) => search.labelPageId });
  const { highlight, terms } = parseSearchQuery(q);

  const viewportRef = useRef<HTMLDivElement>(null);
  const grouped = groupLabelRows(labels, { usage }).sort(byCreatedAtDesc);
  const rows = highlight || !terms.length ? grouped : grouped.filter((row) => matchesSearch(row, terms));
  const itemIds = rows.map((row) => labelTileDomId(row.id));

  // Every tile is mounted, so bringing one into view is a plain scroll
  useEffect(() => {
    if (!navPanelId) return;
    return registerPanelNav(navPanelId, {
      items: () => itemIds.map((id) => ({ id })),
      scrollTo: (id) => document.getElementById(id)?.scrollIntoView({ block: 'nearest' }),
      firstInView: () => firstItemInView(itemIds, viewportRef.current),
    });
  }, [navPanelId, itemIds]);

  // A label link opens its tile once, then leaves the URL: closing the tile must not leave a stale link behind
  useEffect(() => {
    if (!labelPageId || isLoading) return;
    const row = rows.find((candidate) => candidate.siblingIds.includes(labelPageId));
    if (row) {
      labelTileStore.getState().expand(row.id, tileProps.singleExpand);
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
        <LabelTile key={row.id} row={row} highlighted={highlight && matchesSearch(row, terms)} onBoard={!!navPanelId} {...tileProps} />
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

interface LabelListProps extends LabelsScopeProps, LabelsHostProps {}

/** Labels panel body: canonical per-project list at project scope, aggregated list at workspace scope. */
export function LabelList({ entity, entityId, ...hostProps }: LabelListProps) {
  return entity === 'workspace' ? <WorkspaceLabelList entityId={entityId} {...hostProps} /> : <ProjectLabelList entityId={entityId} {...hostProps} />;
}
