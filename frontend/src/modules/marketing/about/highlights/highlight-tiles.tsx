import { useReducedMotion } from 'motion/react';
import { type ReactNode, Suspense, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useInView } from '~/hooks/use-in-view';
import { usePageVisible } from '~/hooks/use-page-visible';
import { BoardPanelHeader } from '~/modules/common/board/board-panel';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { SearchScope } from '~/modules/common/match-highlight/match-scope';
import { SearchChipsField } from '~/modules/common/search-chips/search-chips-field';
import { demoProjects, exportTask, offlineTask, searchQuery, searchSeed } from '~/modules/marketing/about/demo/fixtures';
import { MotionTaskCard } from '~/modules/task/card/motion-task-card';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { matchesBoardSearch, parseBoardSearch } from '~/modules/task/helpers/search-filter';
import { ProductRefButton } from '~/modules/task/product-ref';
import { TaskDemoOffline, TaskDemoScope } from '~/modules/task/task-demo-scope';
import type { Task } from '~/modules/task/types';
import { lazyNamed } from '~/utils/lazy-named';

const CoEdit = lazyNamed(() => import('~/modules/marketing/about/highlights/co-edit'), 'CoEdit');

const noop = () => {};
const copied = async () => true;

interface TileProps {
  label: string;
  /** Fades the right edge too, for content that runs on past it. */
  fadeRight?: boolean;
  children: ReactNode;
}

/** A slice of the real app above a highlight, inert and read as one image. The tiles share a height, so their titles line up. */
function Tile({ label, fadeRight, children }: TileProps) {
  return (
    <TaskDemoScope.Provider value>
      <div role="img" aria-label={label} className="bg-card relative h-64 overflow-hidden rounded-xl border p-4 text-left">
        <div inert className="h-full">
          {children}
        </div>
        <div aria-hidden className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-linear-to-t to-transparent" />
        {fadeRight && <div aria-hidden className="from-card pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l to-transparent" />}
      </div>
    </TaskDemoScope.Provider>
  );
}

/** A project panel's header and its first cards, without the board around it. */
function PanelSlice({ project, tasks }: { project: (typeof demoProjects)[number]; tasks: Task[] }) {
  return (
    <div className="flex w-4/5 shrink-0 flex-col overflow-hidden">
      <BoardPanelHeader
        className="bg-card min-h-11 max-sm:flex"
        leading={
          <span className="flex min-w-0 items-center gap-2 pl-1">
            <EntityAvatar type="project" id={project.id} name={project.name} url={project.thumbnailUrl} className="size-6 text-xs" />
            <span className="truncate font-semibold">{project.name}</span>
            <span className="text-muted-foreground text-sm tabular-nums">{tasks.length}</span>
          </span>
        }
      />
      <div className="border-panel-edge flex flex-col border">
        {tasks.map((task) => (
          <MotionTaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

/** The workspace search, with the panels it filters running on past the tile. */
export function SearchTile() {
  const { t } = useTranslation();
  const search = parseBoardSearch({ q: searchQuery });
  const found = searchSeed.filter((task) => matchesBoardSearch(search, task));

  return (
    <Tile label={t('about:highlights.title_1')} fadeRight>
      <div className="flex flex-col gap-3">
        <SearchChipsField
          value={searchQuery}
          onSearch={noop}
          onReset={noop}
          label={t('c:search_in_resource', { resource: t('c:your_resource', { resource: t('c:workspace') }) })}
          groups={[]}
          chips={[]}
          resultCount={{ count: found.length, resource: 'c:task' }}
          isCountInField
          className="shrink-0 grow-0"
        />
        <SearchScope q={searchQuery}>
          <div className="flex gap-3">
            {demoProjects.map((project) => (
              <PanelSlice key={project.id} project={project} tasks={found.filter((task) => task.projectId === project.id)} />
            ))}
          </div>
        </SearchScope>
      </div>
    </Tile>
  );
}

/** A teammate's named caret writing a todo into the export task, once each time the tile comes fully into view. */
export function CoEditTile() {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const isPageVisible = usePageVisible();
  const { ref, inView } = useInView({ threshold: 0.9 });

  return (
    <Tile label={t('about:highlights.title_2')}>
      <div ref={ref} className="flex h-full flex-col gap-2">
        <div className="flex items-center gap-2 pl-1">
          <ProductRefButton number={exportTask.number} onCopy={copied} />
          <span className="truncate font-medium">{exportTask.name}</span>
        </div>
        <Suspense fallback={null}>
          <CoEdit playing={inView && isPageVisible && !prefersReducedMotion} />
        </Suspense>
      </div>
    </Tile>
  );
}

/** The export task open while offline: its header says it syncs on reconnect. */
export function OfflineTile() {
  const { t } = useTranslation();

  useLayoutEffect(() => {
    useTaskCardStore.getState().setTaskState(offlineTask.id, 'expanded');
  }, []);

  return (
    <Tile label={t('about:highlights.title_3')}>
      <TaskDemoOffline.Provider value>
        <div className="bg-background overflow-hidden rounded-lg border">
          <MotionTaskCard task={offlineTask} />
        </div>
      </TaskDemoOffline.Provider>
    </Tile>
  );
}
