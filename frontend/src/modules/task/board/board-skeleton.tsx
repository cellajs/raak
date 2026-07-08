import { Link, useMatchRoute, useParams } from '@tanstack/react-router';
import { EllipsisVerticalIcon, ExpandIcon, FunnelIcon, PlusIcon, SettingsIcon, TagIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { nanoid } from 'shared/nanoid';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { COLLAPSED_PANEL_MIN_WIDTH, PANEL_MIN_WIDTH } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { TableCount } from '~/modules/common/data-table/table-count';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import type { PageTab } from '~/modules/common/page/tab-nav';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { formatSectionLabel, normalizePanelWidths, prepareBoardPanels } from '~/modules/task/helpers/board-helpers';
import type { BoardPanelProps } from '~/modules/task/panel/board-panel';
import { TaskSearch } from '~/modules/task/task-search';
import { statusSectionColors } from '~/modules/task/task-styles';
import type { BoardResizablePanel } from '~/modules/task/types';
import { Button, buttonVariants } from '~/modules/ui/button';
import { Skeleton } from '~/modules/ui/skeleton';
import { DisplayOptions } from '~/modules/workspace/header/display-options';
import { cn } from '~/utils/cn';

interface Props {
  boardId: string;
  projects?: Project[];
  projectPage?: boolean;
  rowCount?: number;
  rowHeight?: number;
}

/**
 * Render skeleton per panel based on the current board layout
 */
export const BoardSkeleton = ({ boardId, projects = [], projectPage = false, ...prop }: Props) => {
  const { t } = useTranslation();
  const matchRoute = useMatchRoute();
  const isMobile = useBreakpointBelow('sm');

  const isInWorkspace = matchRoute({ to: '/$tenantId/$organizationSlug/workspace/$slug', fuzzy: true });
  const panelStateMap = useTaskBoardStore((state) => state.panelData[boardId]);

  const panels: BoardResizablePanel[] = useMemo(
    () => (isMobile ? [{ panelId: 'mobilePanel' }] : prepareBoardPanels(projects, panelStateMap)),
    [panelStateMap, projects, isMobile],
  );

  const minContainerWidth = useMemo(() => {
    if (!panels.length) return 0;

    const regularPanelCount = panels.filter(
      ({ panelId }) => !useBoardStore.getState().panelCollapseState[panelId],
    ).length;
    const collapsedPanelCount = panels.length - regularPanelCount;

    const regularPanelsSize = regularPanelCount * PANEL_MIN_WIDTH;
    const collapsedPanelsSize = collapsedPanelCount * COLLAPSED_PANEL_MIN_WIDTH;

    return regularPanelsSize + collapsedPanelsSize;
  }, [panels]);

  const storedBoardLayout = useBoardStore((state) => state.boardLayouts[boardId]);

  const defaultSizes = useMemo(
    () =>
      normalizePanelWidths(
        storedBoardLayout ?? {},
        panels.map(({ panelId }) => panelId),
      ),
    [storedBoardLayout, panels],
  );

  const projectTabs: PageTab[] = projects.map((project) => ({
    id: project.id,
    label: project.name,
    path: '/$tenantId/$organizationSlug/workspace/$slug',
    search: { projectSlug: project.slug },
    activeOptions: { exact: false, includeSearch: true },
  }));

  return (
    <>
      <div className="z-85 flex items-center bg-background max-sm:justify-between max-sm:p-2 sm:gap-2">
        <TaskSearch clearSelection={() => {}} toggleFocus={() => {}} />

        <TableCount count={0} label="c:task" className="mr-3" />

        {isInWorkspace ? (
          <>
            <Button className="max-md:hidden" variant="plain">
              <PlusIcon size={16} />
              <span className="ml-1 max-md:hidden xl:hidden">{t('c:add')}</span>
              <span className="ml-1 max-xl:hidden">
                {t('c:add_resource', { resource: t('c:project').toLowerCase() })}
              </span>
            </Button>
            <Button className="max-md:hidden" variant="outline">
              <TagIcon size={16} />
            </Button>
            <Button className="max-md:hidden" variant="outline">
              <SettingsIcon size={16} />
            </Button>

            <Button variant="ghost" className="md:hidden">
              <EllipsisVerticalIcon size={16} />
            </Button>
          </>
        ) : projects.length ? (
          <>
            <div className="hidden grow sm:block" />
            <Button variant="plain" data-form-dirty={false} className="relative hidden rounded sm:inline-flex">
              <PlusIcon size={18} />
              <span className="ml-1">{t('c:task')}</span>
            </Button>
            <Button variant="ghost" className="max-sm:hidden">
              <EllipsisVerticalIcon size={16} />
            </Button>
          </>
        ) : null}

        <DisplayOptions className="max-sm:hidden" />

        <Button variant={'outline'} className={cn('flex max-lg:hidden')}>
          <ExpandIcon size={16} />
        </Button>
      </div>
      <div className="flex h-full flex-row gap-2" style={{ minWidth: minContainerWidth }}>
        {panels.map(({ panelId, project, sectionFilters }) => (
          <div
            key={panelId}
            className="flex h-full flex-col"
            style={{
              minWidth: `${COLLAPSED_PANEL_MIN_WIDTH}px`,
              ...(defaultSizes[panelId] ? { width: `${defaultSizes[panelId]}px` } : {}),
            }}
          >
            {project && (!projectPage || sectionFilters) && (
              <PanelHeaderSkeleton
                boardId={boardId}
                panelId={panelId}
                project={project}
                sectionFilters={sectionFilters}
                projectPage={projectPage}
              />
            )}
            {isInWorkspace && isMobile && <StickyMobilePanelHeader projectTabs={projectTabs} />}
            <PanelBodySkeleton {...prop} />
          </div>
        ))}
      </div>
    </>
  );
};

const StickyMobilePanelHeader = ({ projectTabs }: { projectTabs: PageTab[] }) => {
  // Stable per-instance id — a fresh layoutId per render would break the shared-layout underline animation
  const layoutId = useRef(nanoid()).current;
  return (
    <div className="z-80 block gap-1 border-b bg-background/75 text-center backdrop-blur-xs [scrollbar-width:none] max-sm:overflow-x-auto max-sm:border-t [&::-webkit-scrollbar]:hidden">
      <div className="inline-flex min-w-max gap-1 px-1 sm:flex sm:justify-center">
        {projectTabs.map(
          ({ id, path, label, search = {}, params = true, activeOptions = { exact: false, includeSearch: true } }) => (
            <Link
              key={id}
              resetScroll={false}
              className="focus-effect group relative rounded-sm p-2 last:mr-4 max-sm:p-3 lg:px-4"
              to={path}
              draggable={false}
              params={params}
              search={search}
              activeOptions={activeOptions}
              activeProps={{ 'data-active': true }}
            >
              {({ isActive }) => {
                return (
                  <>
                    <span className="block group-active:translate-y-[.05rem]">{label}</span>
                    {isActive && (
                      <motion.span
                        initial={false}
                        layoutId={layoutId}
                        transition={{ type: 'spring', duration: 0.4, bounce: 0, delay: 0.1 }}
                        className="absolute bottom-0 left-2 h-1 w-[calc(100%-1rem)] rounded-sm bg-primary"
                      />
                    )}
                  </>
                );
              }}
            </Link>
          ),
        )}
      </div>
    </div>
  );
};

const PanelBodySkeleton = ({ rowHeight = 88, rowCount = 12 }: Omit<Props, 'projects' | 'boardId'>) => {
  const renderRowHeight = rowHeight - 8;
  return (
    <div className="flex w-full flex-col overflow-auto border opacity-100 transition-opacity duration-300">
      <div
        className={`-mt-[.05rem] flex h-8 w-full justify-start gap-1 rounded-none border-t border-t-transparent ${statusSectionColors.accepted.border} ${statusSectionColors.accepted.fill} ring-inset`}
      />
      {Array.from({ length: rowCount }).map((_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton is not undergoing mutations
        <div key={index} className="border-b px-1 py-2 hover:bg-transparent">
          <Skeleton className={'w-full rounded'} style={{ height: `${renderRowHeight}px` }} />
        </div>
      ))}
      <div className={`flex h-8 w-full justify-start gap-1 rounded-none ${statusSectionColors.iced.fill} ring-inset`} />
    </div>
  );
};

const PanelHeaderSkeleton = ({
  boardId,
  panelId,
  projectPage,
  project,
  sectionFilters,
}: { panelId: string; projectPage: boolean; boardId: string } & Pick<
  BoardPanelProps,
  'project' | 'sectionFilters'
>) => {
  const { t } = useTranslation();
  const { tenantId } = useParams({ strict: false });

  const panelsSectionView = useTaskBoardStore((state) => state.panelData[boardId]?.[project.id]?.viewSections);
  const isCollapsed = useBoardStore((state) => state.panelCollapseState[panelId]);

  // Check if its primary panel
  const isPrimary = (() => {
    if (!panelsSectionView?.length) return true;
    return panelsSectionView[0] === sectionFilters;
  })();

  return (
    <div className="space-between z-50 flex min-h-13 flex-row items-center gap-2 rounded-lg rounded-b-none border border-b-0 bg-background p-2 max-sm:hidden">
      {tenantId && (
        <div
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'flex h-auto items-center justify-start gap-2 truncate p-0 hover:bg-transparent',
            isCollapsed ? 'w-full justify-center' : 'justify-start',
          )}
        >
          {!projectPage && isPrimary && (
            <EntityAvatar
              className="h-8 w-8"
              id={project.id}
              type="project"
              name={project.name}
              url={project.thumbnailUrl}
            />
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
      )}

      {!isCollapsed && !projectPage && (
        <>
          <div className="hidden grow sm:block" />
          {isPrimary && (
            <Button variant="ghost" className="h-8 px-2 max-sm:hidden" aria-label="Project options">
              <EllipsisVerticalIcon size={16} />
            </Button>
          )}
          <Button data-form variant="plain" size="xs" className="relative hidden rounded sm:inline-flex">
            <PlusIcon size={18} className="transition-transform duration-200" />

            <span className="ml-1">{t('c:task')}</span>
          </Button>
        </>
      )}
    </div>
  );
};
