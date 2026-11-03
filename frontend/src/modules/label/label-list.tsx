import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/types';
import { useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { BirdIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Label } from 'sdk';
import { useLatestRef } from '~/hooks/use-latest-ref';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { Spinner } from '~/modules/common/spinner';
import { groupLabelRows } from '~/modules/label/group-labels';
import { compareLabelHeat, getDroppedLabelRank, isLabelData } from '~/modules/label/label-order';
import { LabelTile, labelTileDomId } from '~/modules/label/label-tile';
import { labelTileStore } from '~/modules/label/label-tile-store';
import { labelsCanonicalOptions, useLabelUpdateMutation } from '~/modules/label/query';
import type { LabelsHostProps, LabelsScopeProps } from '~/modules/label/types';
import { type LabelUsage, useBoardLabelUsage } from '~/modules/label/use-label-usage';
import { projectsListQueryOptions } from '~/modules/project/query';
import { useReadOnlyProjectIds } from '~/modules/project/use-read-only';
import { firstItemInView, registerPanelNav } from '~/modules/task/helpers/panel-nav-registry';
import { ListFocusScope } from '~/modules/task/panel/list-focus-scope';
import { ScrollArea } from '~/modules/ui/scroll-area';

const isPanelLabel = (mode: string) => mode !== 'primary';

// Module-scoped so its identity is stable: useQueries returns a fresh combined value each render
// unless the combine function is referentially stable.
const combinePanelLabels = (results: { data?: { items: Label[] }; isLoading: boolean }[]) => ({
  labels: results.flatMap((result) => result.data?.items ?? []).filter((label) => isPanelLabel(label.mode)),
  pending: results.some((result) => result.isLoading),
});

interface LabelListScopeProps extends LabelsHostProps {
  entityId: string;
}

/** Reads the canonical per-project list the optimistic create splices into, so a just-created label shows without a refetch. */
function ProjectLabelList({ entityId, ...hostProps }: LabelListScopeProps) {
  const { organizationId, tenantId } = useOrganizationLayoutContext();

  const { data, isLoading } = useQuery({
    ...labelsCanonicalOptions({ organizationId, tenantId, projectId: entityId }),
    select: (result) => result.items.filter((label) => isPanelLabel(label.mode)),
  });
  const usage = useBoardLabelUsage([entityId]);

  return <LabelListView labels={data ?? []} usage={usage} isLoading={isLoading} {...hostProps} />;
}

/** Aggregates each project's canonical list client-side, so a just-created label shows without a refetch. */
function WorkspaceLabelList({ entityId, ...hostProps }: LabelListScopeProps) {
  const { organizationId, tenantId } = useOrganizationLayoutContext();

  const { data: projectIds } = useInfiniteQuery({
    ...projectsListQueryOptions({ workspaceId: entityId, excludeArchived: 'true' }),
    select: (data) => data.pages.flatMap((page) => page.items.map((project) => project.id)),
  });

  const { labels, pending } = useQueries({
    queries: (projectIds ?? []).map((projectId) => labelsCanonicalOptions({ organizationId, tenantId, projectId })),
    combine: combinePanelLabels,
  });
  const usage = useBoardLabelUsage(projectIds ?? []);

  return <LabelListView labels={labels} usage={usage} isLoading={projectIds === undefined || pending} showProjectUsage {...hostProps} />;
}

interface LabelListViewProps extends LabelsHostProps {
  labels: Label[];
  usage: LabelUsage;
  isLoading: boolean;
  showProjectUsage?: boolean;
}

function LabelListView({ labels, usage, isLoading, windowScroll, navPanelId, ...tileProps }: LabelListViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const labelPageId = useSearch({ strict: false, select: (search) => search.labelPageId });
  const { mutate: updateLabel } = useLabelUpdateMutation(tenantId, organizationId);

  const viewportRef = useRef<HTMLDivElement>(null);
  const rows = groupLabelRows(labels, { usage }).sort(compareLabelHeat);
  const itemIds = rows.map((row) => labelTileDomId(row.id));
  const readOnlyProjectIds = useReadOnlyProjectIds([...new Set(rows.flatMap((row) => row.projectIds))]);
  const rowsRef = useLatestRef(rows);
  const updateLabelRef = useLatestRef(updateLabel);

  // A dropped or stepped row takes a rank between its new neighbours, written to every sibling, so it lands there on every device
  const placeRow = (sourceId: string, targetId: string, edge: Edge) => {
    const displayOrder = getDroppedLabelRank(rowsRef.current, sourceId, targetId, edge);
    const source = rowsRef.current.find((row) => row.id === sourceId);
    if (displayOrder === null || !source) return;
    for (const id of source.siblingIds) updateLabelRef.current({ id, ops: { displayOrder } });
  };

  // The tiles register the drag and the drop targets; the drop lands through this monitor
  useEffect(() => {
    if (!navPanelId) return;
    return monitorForElements({
      canMonitor: ({ source }) => isLabelData(source.data),
      onDrop: ({ source, location }) => {
        const target = location.current.dropTargets.find((dropTarget) => isLabelData(dropTarget.data));
        if (!isLabelData(source.data) || !target || !isLabelData(target.data)) return;
        const edge = extractClosestEdge(target.data);
        if (edge) placeRow(source.data.id, target.data.id, edge);
      },
    });
  }, [navPanelId]);

  // Every tile is mounted, so bringing one into view is a plain scroll
  useEffect(() => {
    if (!navPanelId) return;
    return registerPanelNav(navPanelId, {
      items: () => itemIds.map((id) => ({ id })),
      scrollTo: (id) => document.getElementById(id)?.scrollIntoView({ block: 'nearest' }),
      firstInView: (preferredId) => firstItemInView(itemIds, viewportRef.current, preferredId),
    });
  }, [navPanelId, itemIds]);

  // A label link opens its tile once, then leaves the URL: closing the tile must not leave a stale link behind
  useEffect(() => {
    if (!labelPageId || isLoading) return;
    const row = rows.find((candidate) => candidate.siblingIds.includes(labelPageId));
    if (row) {
      labelTileStore.getState().expand(row.id);
      requestAnimationFrame(() => document.getElementById(labelTileDomId(row.id))?.scrollIntoView({ block: 'nearest' }));
    }
    navigate({ to: '.', replace: true, resetScroll: false, search: (prev) => ({ ...prev, labelPageId: undefined }) });
  }, [labelPageId, isLoading]);

  if (isLoading) return <Spinner className="my-8" />;
  if (!rows.length) return <ContentPlaceholder icon={BirdIcon} title="c:no_resource_yet" titleOptions={{ resource: t('c:label_other') }} />;

  const list = (
    <ul aria-label={t('c:label_other')}>
      {rows.map((row, index) => (
        <LabelTile
          key={row.id}
          row={row}
          lockedByProjectIds={row.projectIds.filter((projectId) => readOnlyProjectIds.includes(projectId))}
          onBoard={!!navPanelId}
          position={navPanelId ? { index, total: rows.length } : undefined}
          onMove={(step) => {
            const target = rows[index + step];
            if (target) placeRow(row.id, target.id, step < 0 ? 'top' : 'bottom');
          }}
          {...tileProps}
        />
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

  if (windowScroll) return <div className="flex-1">{body}</div>;
  return (
    <ScrollArea className="min-h-0 flex-1" viewportRef={viewportRef}>
      {body}
    </ScrollArea>
  );
}

interface LabelListProps extends LabelsScopeProps, LabelsHostProps {}

export function LabelList({ entity, entityId, ...hostProps }: LabelListProps) {
  return entity === 'workspace' ? <WorkspaceLabelList entityId={entityId} {...hostProps} /> : <ProjectLabelList entityId={entityId} {...hostProps} />;
}
