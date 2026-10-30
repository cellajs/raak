import { EllipsisVerticalIcon, ExpandIcon, InfoIcon, PlusIcon, SettingsIcon, SquareCheckBigIcon, TagIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { collapsedPanelMinWidth, panelMinWidth } from '~/modules/common/board/board-layout';
import { BoardPanelHeader } from '~/modules/common/board/board-panel';
import { LocalPanelShell } from '~/modules/common/board/local-panel-shell';
import { TableCount } from '~/modules/common/data-table/table-count';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { idealWidthFactor } from '~/modules/common/resizable-panels/resizable-panels';
import { FloatingNavButton } from '~/modules/navigation/floating-nav/button';
import { buildBoardExtraPanels, usePanelLayout, useShowExplainer } from '~/modules/task/board/board-hooks';
import { DisplayOptions } from '~/modules/task/board/display-options';
import { ProjectTabNav } from '~/modules/task/board/project-tab-nav';
import { BoardSearch } from '~/modules/task/board-search';
import type { BoardPanelProps } from '~/modules/task/panel/board-panel';
import { PanelSectionRow } from '~/modules/task/panel/panel-section-row';
import { newTaskButtonClass, panelHandleClass, statusSectionColors, taskBarClass } from '~/modules/task/task-styles';
import type { BoardResizablePanel, ProjectResizablePanel } from '~/modules/task/types';
import { Button, buttonVariants } from '~/modules/ui/button';
import { Skeleton } from '~/modules/ui/skeleton';
import { cn } from '~/utils/cn';

const idealPanelWidth = panelMinWidth * idealWidthFactor;
const columnGap = 8;
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

  const showExplainer = useShowExplainer(isInWorkspace);
  const extraPanels = buildBoardExtraPanels({ showExplainer, publicView });

  const { panels: boardPanels, defaultLayout: defaultSizes } = usePanelLayout(boardId, projects, extraPanels);
  const isCollapsed = (panelId: string) => defaultSizes[panelId] <= collapsedPanelMinWidth;
  const panels: SkeletonColumn[] = isMobile ? [{ kind: 'mobile', panelId: 'mobilePanel' }] : boardPanels;

  // The row sizes itself like the live panel group (resizable-panels.md, G6): it fills its parent when every open panel
  // fits at its ideal width, and otherwise scrolls at the ideal or the stored total, whichever is wider.
  const gaps = Math.max(0, panels.length - 1) * columnGap;
  const total = (openWidth: (panelId: string) => number) =>
    panels.reduce((sum, { panelId }) => sum + (isCollapsed(panelId) ? collapsedPanelMinWidth : openWidth(panelId)), gaps);
  const ideal = total(() => idealPanelWidth);
  const stored = total((panelId) => defaultSizes[panelId]);
  // `(ideal - 100%) * 9999` is a switch on the parent's width: far above `stored` while the parent is narrower than `ideal`, negative once it fits.
  const rowMinWidth = isMobile ? undefined : `max(${ideal}px, min(${stored}px, (${ideal}px - 100%) * 9999))`;

  // Open columns share the row in proportion to their widths, as the panel group does when it fills its container.
  const columnStyle = (panelId: string) =>
    isCollapsed(panelId) ? { flex: 'none', width: collapsedPanelMinWidth } : { flex: `${defaultSizes[panelId]} 1 0px`, minWidth: panelMinWidth };

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
            {panel.sectionFilters ? (
              <PanelSectionRow sectionFilters={panel.sectionFilters} />
            ) : (
              !projectPage && <PanelHeaderSkeleton project={panel.project} projectPage={false} isCollapsed={isCollapsed(panel.panelId)} />
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
        <div className="flex h-full" style={{ gap: columnGap, minWidth: rowMinWidth }}>
          {panels.map((panel, index) => {
            const { panelId } = panel;
            if (panel.kind === 'mobile') {
              return (
                <div key={panelId} className="flex h-full w-full min-w-0 flex-col">
                  {renderColumn(panel)}
                </div>
              );
            }
            if (panel.kind === 'project' && panel.sectionFilters) {
              const previous = panels[index - 1];
              if (previous?.kind === 'project' && previous.project.id === panel.project.id) return null;

              const sections = panels.filter(
                (candidate): candidate is ProjectResizablePanel => candidate.kind === 'project' && candidate.project.id === panel.project.id,
              );
              const innerGaps = (sections.length - 1) * columnGap;
              const widthOf = (read: (panelId: string) => number) => sections.reduce((sum, section) => sum + read(section.panelId), innerGaps);
              const groupStyle = { flex: `${widthOf((id) => defaultSizes[id])} 1 0px`, minWidth: widthOf(() => panelMinWidth) };

              return (
                <div key={panel.project.id} className="flex h-full flex-col" style={groupStyle}>
                  <PanelHeaderSkeleton project={panel.project} projectPage={projectPage} isCollapsed={false} className="border-b" />
                  <div className="flex min-h-0 flex-1" style={{ gap: columnGap }}>
                    {sections.map((section) => (
                      <div key={section.panelId} className="flex h-full flex-col" style={columnStyle(section.panelId)}>
                        {renderColumn(section)}
                      </div>
                    ))}
                  </div>
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

  return (
    <div className={taskBarClass} aria-hidden="true" inert>
      <BoardSearch isInWorkspace={isInWorkspace} toggleFocus={() => {}} />

      <TableCount count={hasProjects ? 0 : null} label="c:task" className="mr-3 max-sm:hidden" />

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

      <Button variant="outline" className="max-lg:hidden">
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
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden sm:border">
      <div className={cn('h-9 shrink-0 border-t border-t-transparent', statusSectionColors.accepted.border, statusSectionColors.accepted.fill)} />
      {Array.from({ length: rowCount }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton is not undergoing mutations
        <div key={index} className="border-b px-1 py-2">
          <Skeleton className="w-full rounded" style={{ height: rowHeight }} />
        </div>
      ))}
      <div className={cn('h-9', statusSectionColors.iced.fill)} />
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

interface PanelHeaderSkeletonProps extends Pick<BoardPanelProps, 'project'> {
  projectPage: boolean;
  isCollapsed: boolean;
  className?: string;
}

function PanelHeaderSkeleton({ projectPage, project, isCollapsed, className }: PanelHeaderSkeletonProps) {
  const { t } = useTranslation();

  return (
    <BoardPanelHeader
      className={cn('bg-background', className)}
      isCollapsed={isCollapsed}
      leading={
        <div className={cn(buttonVariants({ variant: 'ghost' }), panelHandleClass, 'truncate', isCollapsed && 'w-full justify-center')}>
          {projectPage ? (
            <div className="flex min-w-8 justify-center">
              <SquareCheckBigIcon className="size-4 shrink-0" />
            </div>
          ) : (
            <EntityAvatar id={project.id} type="project" name={project.name} url={project.thumbnailUrl} />
          )}
          {!isCollapsed && <div className="truncate font-semibold leading-6">{projectPage ? t('c:task_other') : project.name}</div>}
        </div>
      }
      actions={
        <>
          {!projectPage && (
            <Button variant="ghost" className="h-8 px-1.5 max-sm:hidden" aria-label={t('c:resource_options', { resource: t('c:project') })}>
              <EllipsisVerticalIcon />
            </Button>
          )}
          <Button variant="secondary" size="xs" className={newTaskButtonClass}>
            <PlusIcon className="size-4.5" />
            <span>{t('c:task')}</span>
          </Button>
        </>
      }
    />
  );
}
