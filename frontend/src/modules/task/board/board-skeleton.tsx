import { ChevronsLeftRightIcon, EllipsisVerticalIcon, ExpandIcon, InfoIcon, PlusIcon, SettingsIcon, TagIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useMeasure } from '~/hooks/use-measure';
import { collapsedPanelMinWidth, panelMinWidth } from '~/modules/common/board/board-layout';
import { BoardPanelHeader, CollapsedPanelView } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { LocalPanelShell } from '~/modules/common/board/local-panel-shell';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { fitPanels } from '~/modules/common/resizable-panels/panel-layout';
import { idealWidthFactor } from '~/modules/common/resizable-panels/resizable-panels';
import { SearchField } from '~/modules/common/search-field';
import { FloatingAction } from '~/modules/navigation/floating-nav/floating-action';
import { PublicBadge } from '~/modules/project/public-badge';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { useWithMembership } from '~/modules/project/use-with-membership';
import { buildBoardExtraPanels, usePanelLayout, useShowExplainer, useStatusTabList } from '~/modules/task/board/board-hooks';
import { DisplayOptions } from '~/modules/task/board/display-options';
import { ProjectTabNav } from '~/modules/task/board/project-tab-nav';
import { StatusTabNav } from '~/modules/task/board/status-tab-nav';
import { listsEveryStatus, projectPanelName } from '~/modules/task/helpers/board-helpers';
import type { BoardPanelProps } from '~/modules/task/panel/board-panel';
import { newTaskButtonClass, panelHandleClass, statusSectionColors, taskBarClass } from '~/modules/task/task-styles';
import type { BoardResizablePanel } from '~/modules/task/types';
import { Badge } from '~/modules/ui/badge';
import { Button, buttonVariants } from '~/modules/ui/button';
import { Skeleton } from '~/modules/ui/skeleton';
import { cn } from '~/utils/cn';

// The live separator: w-1.5 plus mx-[0.02rem] on each side
const columnGap = 6.64;
const desktopRowHeight = 80;
// A phone wraps a card's title over its own footer row, so mobile cards stand taller than desktop rows
const mobileRowHeight = 102;
const rowCount = 12;

type SkeletonColumn = { kind: 'mobile'; panelId: string } | BoardResizablePanel;

interface BoardSkeletonProps {
  boardId: string;
  projects?: Project[];
  projectPage?: boolean;
  publicView?: boolean;
  isInWorkspace?: boolean;
  /** Suppress the top task bar when a real `BoardHeader` already renders above the skeleton. */
  withHeader?: boolean;
}

/** Loading skeleton per panel; local panels use their real `LocalPanelShell`, so header, collapsed handle and width match the live board. */
export function BoardSkeleton({
  boardId,
  projects = [],
  projectPage = false,
  publicView = false,
  isInWorkspace = false,
  withHeader = true,
}: BoardSkeletonProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');

  const windowScroll = projectPage && publicView;

  const showExplainer = useShowExplainer(isInWorkspace);
  const extraPanels = buildBoardExtraPanels({ showExplainer, publicView });

  const boardProjects = useWithMembership(projects);
  const { panels: boardPanels, defaultLayout: defaultSizes } = usePanelLayout(boardId, boardProjects, { extraPanels, projectPage });
  const fit = useBoardStore((state) => state.boardFits[boardId] ?? false);
  const panels: SkeletonColumn[] = isMobile ? [{ kind: 'mobile', panelId: 'mobilePanel' }] : boardPanels;
  const { ref: rowFrameRef, bounds: rowFrame } = useMeasure<HTMLDivElement>();

  // The row sizes itself like the live panel group (resizable-panels.md, G6): it fills its parent when every open panel
  // fits at its ideal width, and otherwise scrolls at the ideal or the stored total, whichever is wider.
  // A member board's end handle (resizable-panels.md, E1) stands after its last panel
  const endGap = isMobile || publicView ? 0 : columnGap;
  const gaps = Math.max(0, panels.length - 1) * columnGap + endGap;
  // A public board fits its parent, with the live group's own function, so the same panels load closed
  const fitted =
    publicView && !isMobile && rowFrame.width > 0
      ? fitPanels({
          panels: panels.map(({ panelId }) => ({ id: panelId, minWidth: panelMinWidth, collapsedWidth: collapsedPanelMinWidth, collapsible: true })),
          chosen: defaultSizes,
          autoCollapsed: [],
          available: rowFrame.width - gaps,
        }).widths
      : undefined;
  const isCollapsed = (panelId: string) => (fitted?.[panelId] ?? defaultSizes[panelId]) <= collapsedPanelMinWidth;
  const total = (openWidth: (panelId: string) => number) =>
    panels.reduce((sum, { panelId }) => sum + (isCollapsed(panelId) ? collapsedPanelMinWidth : openWidth(panelId)), gaps);
  const ideal = total(() => (fit ? panelMinWidth : panelMinWidth * idealWidthFactor));
  const stored = total((panelId) => defaultSizes[panelId]);
  // `(ideal - 100%) * 9999` is a switch on the parent's width: far above `stored` while the parent is narrower than `ideal`, negative once it fits.
  const rowMinWidth = isMobile || publicView ? undefined : `max(${ideal}px, min(${stored}px, (${ideal}px - 100%) * 9999))`;

  // Open columns share the row in proportion to their widths, as the panel group does when it fills its container.
  const columnStyle = (panelId: string) =>
    fitted && !isCollapsed(panelId)
      ? { flex: 'none', width: fitted[panelId] }
      : isCollapsed(panelId)
        ? { flex: 'none', width: collapsedPanelMinWidth }
        : { flex: `${defaultSizes[panelId]} 1 0px`, minWidth: panelMinWidth };

  const renderColumn = (panel: SkeletonColumn) => {
    switch (panel.kind) {
      case 'mobile':
        return (
          <>
            {isInWorkspace ? (
              <ProjectTabNav projects={boardProjects} />
            ) : (
              projects[0] && <StatusTabNav project={projects[0]} publicView={publicView} />
            )}
            <MobilePanelSkeleton />
          </>
        );
      case 'labels':
        return (
          <LocalPanelShell
            panelId={panel.panelId}
            icon={<TagIcon />}
            title={t('c:label_other')}
            windowScroll={windowScroll}
            isCollapsed={isCollapsed(panel.panelId)}
          >
            <LocalPanelBodySkeleton />
          </LocalPanelShell>
        );
      case 'explainer':
        return (
          <LocalPanelShell
            panelId={panel.panelId}
            icon={<InfoIcon />}
            title={t('c:getting_started')}
            windowScroll={windowScroll}
            isCollapsed={isCollapsed(panel.panelId)}
          >
            <LocalPanelBodySkeleton />
          </LocalPanelShell>
        );
      default:
        return (
          <>
            <PanelHeaderSkeleton project={panel.project} group={panel.group} isCollapsed={isCollapsed(panel.panelId)} />
            {panel.group && isCollapsed(panel.panelId) ? (
              <CollapsedPanelView title={projectPanelName(panel.project, panel.group)} windowScroll={windowScroll} />
            ) : (
              <PanelBodySkeleton rows={isCollapsed(panel.panelId) ? 0 : rowCount} folds={listsEveryStatus(panel.statuses)} />
            )}
          </>
        );
    }
  };

  return (
    <>
      {withHeader && <BoardHeaderSkeleton isInWorkspace={isInWorkspace} hasProjects={!!projects.length} publicView={publicView} />}
      {/* BoardLayout's frame: a loading board scrolls the page no further than the loaded one. */}
      <div
        ref={rowFrameRef}
        className={cn(
          'overflow-x-clip',
          !windowScroll && 'sm:h-[calc(100dvh-var(--board-offset-sm,4rem))] md:h-[calc(100dvh-var(--board-offset-md,4.88rem))]',
        )}
      >
        <div className="flex h-full" style={{ gap: columnGap, minWidth: rowMinWidth, paddingRight: endGap }}>
          {panels.map((panel) => {
            const { panelId } = panel;
            if (panel.kind === 'mobile') {
              return (
                <div key={panelId} className="flex h-full w-full min-w-0 flex-col">
                  {renderColumn(panel)}
                </div>
              );
            }
            return (
              <div key={panelId} className="flex h-full flex-col" style={columnStyle(panelId)}>
                {renderColumn(panel)}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

interface BoardHeaderSkeletonProps {
  isInWorkspace?: boolean;
  hasProjects?: boolean;
  publicView?: boolean;
}

/** Inert stand-in for the board's task bar; like the live one, a board without projects shows no task count. */
export function BoardHeaderSkeleton({ isInWorkspace = false, hasProjects = false, publicView = false }: BoardHeaderSkeletonProps) {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm');
  const showsProjectControls = !isInWorkspace && hasProjects && !publicView;

  return (
    <div className={taskBarClass} aria-hidden="true" inert>
      {showsProjectControls && (
        <>
          <Button variant="ghost" size="icon" className="max-sm:hidden" />
          <Button variant="secondary" className={newTaskButtonClass}>
            <PlusIcon className="size-4.5" />
            <span>{t('c:task')}</span>
          </Button>
        </>
      )}

      <SearchField
        value=""
        onSearch={() => {}}
        label={
          isMobile
            ? t('c:search')
            : t('c:search_in_resource', { resource: isInWorkspace ? t('c:your_resource', { resource: t('c:workspace') }) : t('c:project') })
        }
        className="edgeless sm:min-w-44"
      />

      {isInWorkspace ? (
        <>
          <Button className="max-md:hidden" variant="secondary">
            <PlusIcon />
            <span className="max-md:hidden xl:hidden">{t('c:add')}</span>
            <span className="max-xl:hidden">{t('c:add_resource', { resource: t('c:project') })}</span>
          </Button>
          <Button className="max-md:hidden" variant="outline">
            <SettingsIcon />
          </Button>

          <Button variant="ghost" className="md:hidden">
            <EllipsisVerticalIcon />
          </Button>
        </>
      ) : showsProjectControls ? (
        <Button variant="ghost">
          <EllipsisVerticalIcon />
        </Button>
      ) : null}

      {hasProjects && !publicView && (
        <Button variant="ghost" className="sm:hidden">
          <TagIcon />
        </Button>
      )}

      <DisplayOptions className="max-sm:hidden" />

      <Button variant="outline" className="max-lg:hidden">
        <ExpandIcon />
      </Button>
    </div>
  );
}

/** The mobile panel while its tasks load, with an inert create button where the live one sits. */
export function MobilePanelSkeleton() {
  const { t } = useTranslation();
  const statuses = useStatusTabList();

  return (
    <>
      <PanelBodySkeleton rowHeight={mobileRowHeight} folds={listsEveryStatus(statuses)} />
      <div inert>
        <FloatingAction icon={PlusIcon} label={t('c:create_resource', { resource: t('c:task') })} onClick={() => {}} />
      </div>
    </>
  );
}

interface PanelBodySkeletonProps {
  /** A collapsed panel has none: its strip shows only the status bars at its ends. */
  rows?: number;
  rowHeight?: number;
  /** Whether the accepted and iced bars stand at its ends. */
  folds?: boolean;
}

function PanelBodySkeleton({ rows = rowCount, rowHeight = desktopRowHeight, folds = true }: PanelBodySkeletonProps) {
  return (
    <div className="border-panel-edge flex min-h-0 w-full flex-1 flex-col overflow-hidden sm:border">
      {folds && (
        <div
          className={cn('h-9 shrink-0 border-t border-t-transparent', statusSectionColors.accepted.border.top, statusSectionColors.accepted.fill)}
        />
      )}
      {Array.from({ length: rows }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton is not undergoing mutations
        <div key={index} className="border-b px-1 py-2">
          <Skeleton className="w-full rounded" style={{ height: rowHeight }} />
        </div>
      ))}
      <div className="grow" />
      {folds && <div className={cn('h-9 shrink-0', statusSectionColors.iced.border.bottom, statusSectionColors.iced.fill)} />}
    </div>
  );
}

function LocalPanelBodySkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-2 p-2">
      {Array.from({ length: 6 }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton is not undergoing mutations
        <Skeleton key={index} className="h-10 w-full rounded" />
      ))}
    </div>
  );
}

interface PanelHeaderSkeletonProps extends Pick<BoardPanelProps, 'project' | 'group'> {
  isCollapsed: boolean;
}

function PanelHeaderSkeleton({ project, group, isCollapsed }: PanelHeaderSkeletonProps) {
  const { t } = useTranslation();
  const isReadOnly = useIsProjectReadOnly(project.id);

  return (
    <BoardPanelHeader
      className="bg-background"
      isCollapsed={isCollapsed}
      leading={
        <div className={cn(buttonVariants({ variant: 'ghost' }), panelHandleClass, 'truncate', isCollapsed && 'w-full justify-center')}>
          {group ? (
            isCollapsed && <ChevronsLeftRightIcon className="size-4 shrink-0" />
          ) : (
            <span className="relative flex">
              <EntityAvatar id={project.id} type="project" name={project.name} url={project.thumbnailUrl} />
              {project.public && <PublicBadge />}
            </span>
          )}
          {!isCollapsed && <div className="truncate leading-6 font-semibold">{projectPanelName(project, group)}</div>}
        </div>
      }
      actions={
        !group && (
          <>
            {isReadOnly && (
              <Badge soft className="text-xs font-normal">
                {t('c:read_only')}
              </Badge>
            )}
            <Button variant="ghost" className="h-8 px-1.5 max-sm:hidden" aria-label={t('c:resource_options', { resource: t('c:project') })}>
              <EllipsisVerticalIcon />
            </Button>
            {!isReadOnly && (
              <Button variant="secondary" size="xs" className={cn(newTaskButtonClass, '-ml-1')}>
                <PlusIcon className="size-4.5" />
                <span>{t('c:task')}</span>
              </Button>
            )}
          </>
        )
      }
    />
  );
}
