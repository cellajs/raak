import { EllipsisVerticalIcon, ExpandIcon, FunnelIcon, InfoIcon, PlusIcon, SettingsIcon, TagIcon } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { collapsedPanelMinWidth, panelMinWidth } from '~/modules/common/board/board-layout';
import { BoardPanelHeader } from '~/modules/common/board/board-panel';
import { useBoardStore } from '~/modules/common/board/board-store';
import { LocalPanelShell } from '~/modules/common/board/local-panel-shell';
import { TableCount } from '~/modules/common/data-table/table-count';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { idealWidthFactor } from '~/modules/common/resizable-panels/resizable-panels';
import { FloatingNavButton } from '~/modules/navigation/floating-nav/button';
import { buildBoardExtraPanels, usePanelLayout, useShowExplainer } from '~/modules/task/board/board-hooks';
import { DisplayOptions } from '~/modules/task/board/display-options';
import { ProjectTabNav } from '~/modules/task/board/project-tab-nav';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { BoardSearch } from '~/modules/task/board-search';
import { formatSectionLabel, isPrimarySection, panelHostsDraft } from '~/modules/task/helpers/board-helpers';
import type { BoardPanelProps } from '~/modules/task/panel/board-panel';
import { TaskStatus } from '~/modules/task/task-properties';
import { statusSectionColors, taskBarClass } from '~/modules/task/task-styles';
import type { BoardResizablePanel } from '~/modules/task/types';
import { Button, buttonVariants } from '~/modules/ui/button';
import { Skeleton } from '~/modules/ui/skeleton';
import { cn } from '~/utils/cn';

const idealPanelWidth = panelMinWidth * idealWidthFactor;
const columnGap = 8;
const desktopRowHeight = 88;
// A phone wraps a card's title over its own footer row, so mobile cards stand taller than desktop rows
const mobileRowHeight = 110;
const rowCount = 12;

/** The mobile placeholder column carries no project or kind; desktop columns are real board panels. */
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

/**
 * Render skeleton per panel based on the current board layout. Project panels get task-row
 * placeholders; the labels and getting-started panels render through their real `LocalPanelShell`
 * frame so their header, collapsed handle and persisted width match the live board exactly.
 */
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

  const panelCollapseState = useBoardStore((state) => state.panelCollapseState);

  // Match the live board's local-panel set so the skeleton shows the same labels / explainer columns.
  const showExplainer = useShowExplainer(isInWorkspace);
  const extraPanels = useMemo(() => buildBoardExtraPanels({ showExplainer, publicView }), [showExplainer, publicView]);

  const { panels: boardPanels, defaultLayout: defaultSizes } = usePanelLayout(boardId, projects, extraPanels);
  const panels: SkeletonColumn[] = isMobile ? [{ kind: 'mobile', panelId: 'mobilePanel' }] : boardPanels;

  // The row sizes itself like the live panel group (resizable-panels.md, G6): it fills its parent when every open panel
  // fits at its ideal width, and otherwise scrolls at the ideal or the stored total, whichever is wider.
  const rowMinWidth = useMemo(() => {
    if (isMobile) return undefined;
    const gaps = Math.max(0, panels.length - 1) * columnGap;
    const total = (openWidth: (panelId: string) => number) =>
      panels.reduce((sum, { panelId }) => sum + (panelCollapseState[panelId] ? collapsedPanelMinWidth : openWidth(panelId)), gaps);
    const ideal = total(() => idealPanelWidth);
    const stored = total((panelId) => defaultSizes[panelId]);
    // `(ideal - 100%) * 9999` is a switch on the parent's width: far above `stored` while the parent is narrower than `ideal`, negative once it fits.
    return `max(${ideal}px, min(${stored}px, (${ideal}px - 100%) * 9999))`;
  }, [isMobile, panels, panelCollapseState, defaultSizes]);

  const renderColumn = (panel: SkeletonColumn) => {
    switch (panel.kind) {
      case 'mobile':
        return (
          <>
            {isInWorkspace && <ProjectTabNav projects={projects} />}
            <MobilePanelSkeleton />
          </>
        );
      case 'labels':
        return (
          <LocalPanelShell panelId={panel.panelId} icon={<TagIcon />} title={t('c:label_other').toLowerCase()} windowScroll={projectPage}>
            <LocalPanelBodySkeleton />
          </LocalPanelShell>
        );
      case 'explainer':
        return (
          <LocalPanelShell panelId={panel.panelId} icon={<InfoIcon />} title={t('c:getting_started')} windowScroll={projectPage}>
            <LocalPanelBodySkeleton />
          </LocalPanelShell>
        );
      default:
        return (
          <>
            {(!projectPage || panel.sectionFilters) && (
              <PanelHeaderSkeleton
                boardId={boardId}
                panelId={panel.panelId}
                project={panel.project}
                sectionFilters={panel.sectionFilters}
                projectPage={projectPage}
              />
            )}
            <PanelBodySkeleton />
          </>
        );
    }
  };

  return (
    <>
      {withHeader && <BoardHeaderSkeleton isInWorkspace={isInWorkspace} hasProjects={!!projects.length} publicView={publicView} />}
      {/* BoardLayout's frame: a loading board scrolls the page no further than the loaded one. */}
      <div
        className={cn(
          'overflow-x-clip',
          !projectPage && 'sm:h-[calc(100dvh-var(--board-offset-sm,4rem))] md:h-[calc(100dvh-var(--board-offset-md,4.88rem))]',
        )}
      >
        <div className="flex h-full flex-row" style={{ gap: columnGap, minWidth: rowMinWidth }}>
          {panels.map((panel) => {
            const { panelId } = panel;
            if (panel.kind === 'mobile') {
              return (
                <div key={panelId} className="flex h-full w-full min-w-0 flex-col">
                  {renderColumn(panel)}
                </div>
              );
            }
            // Open columns share the row in proportion to their widths, as the panel group does when it fills its container.
            const columnStyle = panelCollapseState[panelId]
              ? { flex: 'none', width: collapsedPanelMinWidth }
              : { flex: `${defaultSizes[panelId]} 1 0px`, minWidth: panelMinWidth };
            return (
              <div key={panelId} className="flex h-full flex-col" style={columnStyle}>
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

  return (
    <div className={taskBarClass} aria-hidden="true" inert>
      <BoardSearch isInWorkspace={isInWorkspace} toggleFocus={() => {}} />

      <TableCount count={hasProjects ? 0 : null} label="c:task" className="mr-3" />

      {isInWorkspace ? (
        <>
          <Button className="max-md:hidden" variant="plain">
            <PlusIcon />
            <span className="max-md:hidden xl:hidden">{t('c:add')}</span>
            <span className="max-xl:hidden">{t('c:add_resource', { resource: t('c:project').toLowerCase() })}</span>
          </Button>
          <Button className="max-md:hidden" variant="outline">
            <SettingsIcon />
          </Button>

          <Button variant="ghost" className="md:hidden">
            <EllipsisVerticalIcon />
          </Button>
        </>
      ) : hasProjects && !publicView ? (
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

      <Button variant={'outline'} className={cn('flex max-lg:hidden')}>
        <ExpandIcon />
      </Button>
    </div>
  );
}

/** The mobile panel while its tasks load, with an inert create button where the live one sits. */
export function MobilePanelSkeleton() {
  return (
    <>
      <PanelBodySkeleton rowHeight={mobileRowHeight} />
      <div inert>
        <FloatingNavButton id="create-task-placeholder" icon={PlusIcon} onClick={() => {}} />
      </div>
    </>
  );
}

interface PanelBodySkeletonProps {
  rowHeight?: number;
}

function PanelBodySkeleton({ rowHeight = desktopRowHeight }: PanelBodySkeletonProps) {
  const renderRowHeight = rowHeight - 8;
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden opacity-100 transition-opacity duration-300 sm:border">
      <div
        className={`flex h-9 w-full shrink-0 justify-start gap-1 rounded-none border-t border-t-transparent ${statusSectionColors.accepted.border} ${statusSectionColors.accepted.fill} ring-inset`}
      />
      {Array.from({ length: rowCount }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton is not undergoing mutations
        <div key={index} className="border-b px-1 py-2 hover:bg-transparent">
          <Skeleton className={'w-full rounded'} style={{ height: `${renderRowHeight}px` }} />
        </div>
      ))}
      <div className={`flex h-9 w-full justify-start gap-1 rounded-none ${statusSectionColors.iced.fill} ring-inset`} />
    </div>
  );
}

/** Placeholder rows for a local panel body (labels / getting-started), shown inside its real shell. */
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

interface PanelHeaderSkeletonProps extends Pick<BoardPanelProps, 'project' | 'sectionFilters'> {
  boardId: string;
  panelId: string;
  projectPage: boolean;
}

function PanelHeaderSkeleton({ boardId, panelId, projectPage, project, sectionFilters }: PanelHeaderSkeletonProps) {
  const { t } = useTranslation();

  const viewSections = useTaskBoardStore((state) => state.panelData[boardId]?.[project.id]?.viewSections);
  const isCollapsed = useBoardStore((state) => state.panelCollapseState[panelId]);

  const isPrimary = isPrimarySection(viewSections, sectionFilters);
  const hostsCreateButton = panelHostsDraft(viewSections, project.id, panelId, TaskStatus.Unstarted);

  return (
    <BoardPanelHeader
      className="bg-background"
      isCollapsed={!!isCollapsed}
      leading={
        <div
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'flex h-auto items-center justify-start gap-2 truncate p-0 hover:bg-transparent',
            isCollapsed ? 'w-full justify-center' : 'justify-start',
          )}
        >
          {!projectPage && isPrimary && (
            <EntityAvatar className="h-8 w-8" id={project.id} type="project" name={project.name} url={project.thumbnailUrl} />
          )}
          {(projectPage || !isPrimary) && sectionFilters && (
            <div className={cn('flex justify-center', (projectPage || !isPrimary) && 'min-w-8')}>
              <FunnelIcon className="h-4 w-4 shrink-0" />
            </div>
          )}
          {!isCollapsed && (
            <div className="truncate font-semibold leading-6">
              {isPrimary && !projectPage && project.name}
              {(!isPrimary || projectPage) && sectionFilters && (
                <span className={!projectPage ? 'pr-1 italic' : ''}>{formatSectionLabel(sectionFilters)}</span>
              )}
            </div>
          )}
        </div>
      }
      actions={
        !projectPage && (
          <>
            {isPrimary && (
              <Button variant="ghost" className="h-8 px-2 max-sm:hidden" aria-label={t('c:resource_options', { resource: t('c:project') })}>
                <EllipsisVerticalIcon />
              </Button>
            )}
            {hostsCreateButton && (
              <Button variant="plain" size="xs" className="relative hidden rounded sm:inline-flex">
                <PlusIcon className="size-4.5 transition-transform duration-200" />

                <span className="">{t('c:task')}</span>
              </Button>
            )}
          </>
        )
      }
    />
  );
}
