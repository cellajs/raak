import { AnimatePresence, MotionConfig, useReducedMotion } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useInView } from '~/hooks/use-in-view';
import { usePageVisible } from '~/hooks/use-page-visible';
import { BoardLayout, panelMinWidth } from '~/modules/common/board/board-layout';
import { useBoardStore } from '~/modules/common/board/board-store';
import { DemoCursor, type DemoCursorState } from '~/modules/marketing/about/demo/demo-cursor';
import { type DemoStage, playDemoRound } from '~/modules/marketing/about/demo/demo-script';
import { DemoTabs } from '~/modules/marketing/about/demo/demo-tabs';
import { DemoTypeMenu, type DemoTypeMenuAnchor, demoTypeMenuHeight } from '~/modules/marketing/about/demo/demo-type-menu';
import { demoProjects, demoSeed, website } from '~/modules/marketing/about/demo/fixtures';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import { usePanelLayout } from '~/modules/task/board/board-hooks';
import { useTaskDropLandingStore } from '~/modules/task/board/task-drop-landing-store';
import { useUnseenTasksStore } from '~/modules/task/board/unseen-tasks-store';
import { TaskCardDragPreview } from '~/modules/task/card/task-card-drag-preview';
import { taskFieldTriggerId } from '~/modules/task/helpers/open-task-dropdown';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { BoardPanel } from '~/modules/task/panel/board-panel';
import { TaskDemoScope } from '~/modules/task/task-demo-scope';
import type { Task } from '~/modules/task/types';
import { cn } from '~/utils/cn';

const boardId = 'about-demo';
const stopped = Symbol('stopped');
const noop = () => {};
const dragSteps = 50;
const keepRealPointerOut = (event: PointerEvent) => {
  if (event.isTrusted) event.stopPropagation();
};
const easeInOut = (progress: number) => (progress < 0.5 ? 2 * progress ** 2 : 1 - (-2 * progress + 2) ** 2 / 2);

interface TypeMenuState {
  task: Task;
  highlightedId: string;
  anchor?: DemoTypeMenuAnchor;
}

interface CarriedCard {
  task: Task;
  width: number;
  height: number;
}

/** The real divider drag: the panel group follows the pointer on the document, and a scripted pointer has nothing to capture. */
const playDividerDrag = async (divider: HTMLElement, travel: number, sleep: DemoStage['sleep'], onMove: (clientX: number) => void) => {
  const { left, width, top, height } = divider.getBoundingClientRect();
  const startX = left + width / 2;
  const pointer = (type: string, clientX: number) =>
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      buttons: 1,
      clientX,
      clientY: top + height / 2,
    });

  divider.setPointerCapture = noop;
  // The group follows any pointer, and the visitor's mouse must not pull the divider around
  window.addEventListener('pointermove', keepRealPointerOut, true);
  window.addEventListener('pointerup', keepRealPointerOut, true);
  divider.dispatchEvent(pointer('pointerdown', startX));
  try {
    for (let step = 1; step <= dragSteps; step += 1) {
      await sleep(16);
      const clientX = startX + travel * easeInOut(step / dragSteps);
      document.dispatchEvent(pointer('pointermove', clientX));
      onMove(clientX);
    }
  } finally {
    document.dispatchEvent(pointer('pointerup', startX + travel));
    window.removeEventListener('pointermove', keepRealPointerOut, true);
    window.removeEventListener('pointerup', keepRealPointerOut, true);
  }
};

const clearSharedStores = () => {
  useBoardFocusStore.getState().reset();
  useUnseenTasksStore.getState().clear();
  useTaskDropLandingStore.getState().setLanding(null);
};

/** Real board panels playing a script over made-up tasks, without a request, and out of the visitor's way: nothing in it takes a press or focus. */
export function DemoBoard() {
  const isPhone = useBreakpointBelow('sm');
  const prefersReducedMotion = useReducedMotion();
  const isPageVisible = usePageVisible();
  const { ref: inViewRef, inView } = useInView({ threshold: 0.2 });
  const frameRef = useRef<HTMLDivElement>(null);

  const [tasks, setTasks] = useState(() => demoSeed(isPhone));
  const [cursor, setCursor] = useState<DemoCursorState>({ x: 220, y: 120, name: '', pressed: false, visible: false });
  const [carried, setCarried] = useState<CarriedCard | null>(null);
  const [typeMenu, setTypeMenu] = useState<TypeMenuState | null>(null);
  const [isFading, setIsFading] = useState(false);
  const [phoneProjectId, setPhoneProjectId] = useState(website.id);
  // A new key puts the panels back at their first widths, which only their group holds
  const [layoutRound, setLayoutRound] = useState(0);

  const { panels, defaultLayout } = usePanelLayout(boardId, demoProjects);
  const setActiveBoard = useBoardStore((state) => state.setActiveBoard);
  // Before paint: panels read which way their lists run from the active board
  useLayoutEffect(() => {
    setActiveBoard(boardId);
  }, [setActiveBoard]);

  const isPlaying = inView && isPageVisible && !prefersReducedMotion;

  useEffect(() => {
    if (!isPlaying) return;

    let isStopped = false;

    const elementOf = (selector: string) => frameRef.current?.querySelector(selector)?.getBoundingClientRect();
    const frameRect = () => frameRef.current?.getBoundingClientRect();

    const stage: DemoStage = {
      isPhone,
      sleep: async (ms) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        if (isStopped) throw stopped;
      },
      point: (selector, name) => {
        const frame = frameRect();
        const target = elementOf(selector);
        if (!frame || !target) return;
        setCursor((current) => ({
          ...current,
          visible: true,
          name: name ?? current.name,
          x: target.left - frame.left + target.width / 2,
          y: target.top - frame.top + target.height / 2,
        }));
      },
      press: async () => {
        setCursor((current) => ({ ...current, pressed: true }));
        await stage.sleep(180);
        setCursor((current) => ({ ...current, pressed: false }));
      },
      hideCursor: () => setCursor((current) => ({ ...current, visible: false })),
      addTask: (task) => setTasks((current) => [...current, task]),
      patchTask: (id, change) => setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...change(task) } : task))),
      emphasize: (id, glow = true) => {
        useBoardFocusStore.getState().setCurrentItemId(id);
        if (glow) requestAnimationFrame(() => triggerTaskGlow(id));
      },
      markNew: (id) => useUnseenTasksStore.getState().add([id]),
      openTypeMenu: (task) => {
        const frame = frameRect();
        const trigger = frameRef.current?.querySelector(`[id="${taskFieldTriggerId('primaryLabel', task.id, false)}"]`);
        const triggerRect = trigger?.getBoundingClientRect();
        if (!frame || !triggerRect) return;
        // Draws the card's real focus bar, as an open dropdown does
        trigger?.setAttribute('data-dropdowner-active', '');
        const opensUp = triggerRect.bottom + 8 + demoTypeMenuHeight > Math.min(frame.bottom, window.innerHeight);
        const y = opensUp ? triggerRect.top - frame.top - 8 : triggerRect.bottom - frame.top + 8;
        setTypeMenu({
          task,
          highlightedId: task.primaryLabelId ?? '',
          anchor: isPhone ? undefined : { x: triggerRect.left - frame.left, y, above: opensUp },
        });
      },
      highlightType: (typeId) => setTypeMenu((current) => current && { ...current, highlightedId: typeId }),
      closeTypeMenu: () => {
        frameRef.current?.querySelector('[data-dropdowner-active]')?.removeAttribute('data-dropdowner-active');
        setTypeMenu(null);
      },
      carry: (id) => {
        const rect = elementOf(`[data-task-card-id="${id}"]`);
        const task = tasks.find((candidate) => candidate.id === id);
        if (!rect || !task) return;
        setCursor((current) => ({ ...current, pressed: true }));
        setCarried({ task, width: rect.width, height: rect.height });
      },
      carryTo: (landingTaskId) => {
        const frame = frameRect();
        const landing = elementOf(`[data-task-card-id="${landingTaskId}"]`);
        if (!frame || !landing) return;
        setCursor((current) => ({ ...current, x: landing.left - frame.left + landing.width / 2, y: landing.bottom - frame.top }));
        useTaskDropLandingStore.getState().setLanding({ taskId: landingTaskId, edge: 'bottom' });
      },
      drop: () => {
        setCarried(null);
        setCursor((current) => ({ ...current, pressed: false }));
        useTaskDropLandingStore.getState().setLanding(null);
      },
      dragDivider: async (distance) => {
        const frame = frameRect();
        const divider = frameRef.current?.querySelector<HTMLElement>('[role="separator"]');
        const start = divider?.getBoundingClientRect();
        if (!frame || !divider || !start) return;

        // On a narrow window the panel being narrowed holds its real minimum
        const travel = Math.min(distance, frame.right - start.right - panelMinWidth);
        if (travel <= 0) return;

        setCursor((current) => ({ ...current, pressed: true, tracking: true }));
        await playDividerDrag(divider, travel, stage.sleep, (clientX) => setCursor((current) => ({ ...current, x: clientX - frame.left }))).finally(
          () => setCursor((current) => ({ ...current, pressed: false, tracking: false })),
        );
      },
      showProject: setPhoneProjectId,
      reset: async () => {
        setIsFading(true);
        await stage.sleep(450);
        clearSharedStores();
        setTasks(demoSeed(isPhone));
        setPhoneProjectId(website.id);
        setLayoutRound((current) => current + 1);
        await stage.sleep(60);
        setIsFading(false);
      },
    };

    const play = async () => {
      setTasks(demoSeed(isPhone));
      setPhoneProjectId(website.id);
      setLayoutRound((current) => current + 1);
      setIsFading(false);
      while (!isStopped) await playDemoRound(stage);
    };

    play().catch((reason) => {
      if (reason !== stopped) throw reason;
    });

    return () => {
      isStopped = true;
      setTypeMenu(null);
      setCarried(null);
      setCursor((current) => ({ ...current, visible: false, pressed: false }));
      frameRef.current?.querySelector('[data-dropdowner-active]')?.removeAttribute('data-dropdowner-active');
      clearSharedStores();
    };
  }, [isPlaying, isPhone]);

  const panelFor = (projectId: string, panelId: string) => {
    const project = demoProjects.find(({ id }) => id === projectId) ?? website;
    const projectTasks = tasks.filter((task) => task.projectId === projectId);
    return <BoardPanel fetchedTasks={projectTasks} project={project} projectFetchedCount={projectTasks.length} panelId={panelId} showProject />;
  };

  return (
    <TaskDemoScope.Provider value>
      <MotionConfig reducedMotion="user">
        <div
          ref={(node) => {
            frameRef.current = node;
            inViewRef(node);
          }}
          className="relative flex size-full flex-col"
        >
          <div inert className={cn('flex min-h-0 flex-1 flex-col transition-opacity duration-400', isFading && 'opacity-0')}>
            {isPhone ? (
              <>
                <DemoTabs activeId={phoneProjectId} />
                {/* Keyed: virtua keeps measured heights by index, and they are another list's on the next tab */}
                <div key={phoneProjectId} className="min-h-0 flex-1 overflow-hidden">
                  {panelFor(phoneProjectId, phoneProjectId)}
                </div>
              </>
            ) : (
              // Layout and panels size themselves against the app chrome; here that is what the frame leaves over, less its padding and the panel header
              <div className="min-h-0 flex-1 [--board-offset-md:calc(100dvh-var(--demo-height)+1.625rem)] [--board-offset-sm:calc(100dvh-var(--demo-height)+1.625rem)] [--board-panel-offset:calc(100dvh-var(--demo-height)+4.875rem)]">
                <BoardLayout
                  key={layoutRound}
                  boardId={boardId}
                  panels={panels.map(({ panelId }) => ({ panelId }))}
                  defaultLayout={defaultLayout}
                  panelFade="marked"
                >
                  {(panelId) => {
                    const panel = panels.find((candidate) => candidate.panelId === panelId);
                    return panel?.kind === 'project' ? panelFor(panel.project.id, panel.panelId) : null;
                  }}
                </BoardLayout>
              </div>
            )}
          </div>

          <div aria-hidden className="pointer-events-none contents">
            <AnimatePresence>
              {typeMenu && <DemoTypeMenu task={typeMenu.task} highlightedId={typeMenu.highlightedId} anchor={typeMenu.anchor} />}
            </AnimatePresence>
          </div>

          <DemoCursor cursor={cursor} nameOnLeft={isPhone && cursor.x > 280}>
            {carried && (
              <div className="absolute" style={{ width: carried.width, left: -carried.width / 2, top: -carried.height / 2 }}>
                <TaskCardDragPreview task={carried.task} />
              </div>
            )}
          </DemoCursor>
        </div>
      </MotionConfig>
    </TaskDemoScope.Provider>
  );
}
