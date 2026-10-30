import i18n from 'i18next';
import { collapsedPanelMinWidth, panelMinWidth } from '~/modules/common/board/board-layout';
import type { EnrichedProject } from '~/modules/project/types';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import type { BoardPanelData, SectionsValue, TogglableStatusType } from '~/modules/task/board/task-board-store';
import { taskCardStore } from '~/modules/task/card/task-card-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { matchesBoardSearch } from '~/modules/task/helpers/search-filter';
import { compareTaskOrder } from '~/modules/task/helpers/sort-helpers';
import { taskInteractionStore } from '~/modules/task/task-interaction-store';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import type { BoardResizablePanel, BoardSearchParams, ProjectResizablePanel, Task, TaskCounts } from '~/modules/task/types';

const iced = TaskStatus.Iced;
const accepted = TaskStatus.Accepted;

/** Board tasks in order; the open create-form draft is exempt from the accepted/iced collapse. */
export const prepareBoardTasks = (tasks: Task[], showAccepted: boolean, showIced: boolean) => {
  return tasks
    .filter(
      (task) =>
        isDraftTask(task) ||
        (showAccepted && task.status === accepted) ||
        (showIced && task.status === iced) ||
        (task.status !== accepted && task.status !== iced),
    )
    .sort(compareTaskOrder);
};

/** The split the project menu offers: each status in one section, from work in progress on the left to work not started. */
export const defaultSplitSections: SectionsValue[] = [
  { status: [accepted, TaskStatus.Reviewed, TaskStatus.Delivered, TaskStatus.Finished, TaskStatus.Started] },
  { status: [TaskStatus.Unstarted, iced] },
];

/** Whether a task's status is one of a split panel's sections. */
export const inSections = (task: Task, sectionFilters: SectionsValue) => sectionFilters.status.includes(task.status);

const makePanelKey = (projectId: string, section: SectionsValue) => {
  const keyParts = Object.entries(section)
    .map(([key, values]) => {
      const normalizedValues = values.map((value) => String(value).toLowerCase()).join('-');
      return `${key}-${normalizedValues}`;
    })
    .join('__'); // double underscore separates categories, e.g. status__impact

  return `${projectId}-${keyParts}`;
};

/** The panel id of a project, or of one split section of it. */
export const sectionPanelId = (projectId: string, section?: SectionsValue) => (section ? makePanelKey(projectId, section) : projectId);

/** The panels a project shows: one per split section, else itself. */
export const projectPanelIds = (projectId: string, viewSections: SectionsValue[] | undefined) =>
  viewSections?.length ? viewSections.map((section) => makePanelKey(projectId, section)) : [projectId];

/** Panel widths after a project splits: its sections share its width evenly. */
export const splitPanelLayout = (layout: Record<string, number>, projectId: string, panelIds: string[]) => {
  const { [projectId]: width, ...rest } = layout;
  if (width === undefined) return rest;
  const share = Math.max(panelMinWidth, width / panelIds.length);
  return { ...rest, ...Object.fromEntries(panelIds.map((panelId) => [panelId, share])) };
};

/** Panel widths after a project merges: it takes the width of its sections together, unless it is collapsed. */
export const mergePanelLayout = (layout: Record<string, number>, projectId: string, panelIds: string[]) => {
  const rest = Object.fromEntries(Object.entries(layout).filter(([panelId]) => !panelIds.includes(panelId)));
  if (layout[projectId] <= collapsedPanelMinWidth) return rest;
  const width = panelIds.reduce((sum, panelId) => sum + (layout[panelId] ?? 0), 0);
  return { ...rest, [projectId]: Math.max(panelMinWidth, width) };
};

export const sortByMembership = (projects: EnrichedProject[]) => {
  return [...projects].sort((a, b) => (a.membership?.displayOrder ?? 0) - (b.membership?.displayOrder ?? 0));
};

/** Orders tasks as the board shows them: panels by membership, then status and display order. */
export const sortTasksAsOnBoard = (tasks: Task[], projects: EnrichedProject[]) => {
  const panelIndex = new Map(sortByMembership(projects).map((project, index) => [project.id, index]));
  return [...tasks].sort((a, b) => (panelIndex.get(a.projectId) ?? 0) - (panelIndex.get(b.projectId) ?? 0) || compareTaskOrder(a, b));
};

/** projectId → split sections of one board; unsplit projects are absent. */
type BoardViewSections = Record<string, SectionsValue[]>;

/** Narrows a board's panel data to its split sections, the only part the panel layout depends on. */
export const pickViewSections = (board: BoardPanelData | undefined): BoardViewSections => {
  const sections: BoardViewSections = {};
  if (!board) return sections;
  for (const [projectId, { viewSections }] of Object.entries(board)) {
    if (viewSections) sections[projectId] = viewSections;
  }
  return sections;
};

/** The split sections a board shows. A collapsed project is one panel, known by its stored width, and gets its sections back on expanding. */
export const openViewSections = (sections: BoardViewSections, layout: Record<string, number> = {}) =>
  Object.fromEntries(Object.entries(sections).filter(([projectId]) => !(layout[projectId] <= collapsedPanelMinWidth)));

export const prepareBoardPanels = (projects: EnrichedProject[], viewSectionsByProject: BoardViewSections) => {
  const sortedProjects = sortByMembership(projects);

  return sortedProjects.flatMap((project): ProjectResizablePanel[] => {
    const viewSections = viewSectionsByProject[project.id];
    if (!viewSections?.length) return [{ kind: 'project', project, panelId: project.id }];

    return viewSections.map((sectionCriteria) => ({
      kind: 'project',
      project,
      sectionFilters: sectionCriteria,
      panelId: makePanelKey(project.id, sectionCriteria),
    }));
  });
};

/** A project panel's name: the project, and for a split panel its section too. */
export const projectPanelName = (project: { name: string }, sectionFilters?: SectionsValue) =>
  sectionFilters ? `${project.name}: ${formatSectionLabel(sectionFilters)}` : project.name;

export const sectionBarId = (type: TogglableStatusType, projectId: string) => `section-${type}-${projectId}`;

/** Whether a panel shows the accepted or iced bar: accepted also for older accepted tasks beyond the cut-off alone. */
export const hasSectionBar = (type: TogglableStatusType, counts: TaskCounts) =>
  type === 'iced' ? counts.showIced && !!counts.iced : counts.showAccepted && (!!counts.accepted || counts.acceptedCutOff > 0);

// The path a task takes, with iced off the end of it: a run of statuses reads as a stretch of this path
const statusPath = [TaskStatus.Unstarted, TaskStatus.Started, TaskStatus.Finished, TaskStatus.Delivered, TaskStatus.Reviewed, accepted, iced];

/** A section's name: "Started to accepted" for a run of statuses, "Backlog and iced" for two. */
export const formatSectionLabel = ({ status }: SectionsValue): string => {
  const steps = statusPath.filter((step) => status.includes(step));
  const names = steps.map((step) => i18n.t(`c:${statusOptionsByValue[step].status}`));
  if (names.length < 2) return names.join();

  const first = names[0];
  const last = names[names.length - 1].toLowerCase();
  if (names.length === 2) return i18n.t('c:status_pair', { first, second: last });

  const isRun = statusPath.indexOf(steps[steps.length - 1]) - statusPath.indexOf(steps[0]) === steps.length - 1;
  return isRun ? i18n.t('c:status_range', { from: first, to: last }) : names.join(', ');
};

export const normalizePanelWidths = (storedLayout: Record<string, number>, panels: BoardResizablePanel[]) => {
  const layout: Record<string, number> = {};

  for (const panel of panels) {
    const width = storedLayout[panel.panelId] ?? panelMinWidth;
    // A layout stored while sections could collapse may still hold a collapsed width for one
    layout[panel.panelId] = panel.kind === 'project' && panel.sectionFilters ? Math.max(panelMinWidth, width) : width;
  }

  return layout;
};

/** Board identity of the last `resetTaskInteraction` call, to skip same-board re-entries. */
let lastInteractionBoardKey: string | null = null;

/** Resets selection, focus, drafts and card view state on entering or leaving a board; a `boardKey` skips same-board re-entries. */
export const resetTaskInteraction = (boardKey?: string) => {
  if (boardKey && boardKey === lastInteractionBoardKey) return;
  lastInteractionBoardKey = boardKey ?? null;
  taskInteractionStore.getState().reset();
  useBoardFocusStore.getState().reset();
  taskCardStore.getState().reset();
};

/** The tasks a panel renders, in render order: the board search, the panel's section filters, then the accepted/iced folds. */
export const renderedPanelTasks = (
  panel: ProjectResizablePanel,
  tasks: Task[],
  search: { q?: string; matchMode?: BoardSearchParams['matchMode'] },
  prefs: { expandAccepted: boolean; expandIced: boolean },
) => {
  const inPanel = tasks.filter(
    (task) =>
      task.projectId === panel.project.id && matchesBoardSearch(search, task) && (!panel.sectionFilters || inSections(task, panel.sectionFilters)),
  );
  return prepareBoardTasks(inPanel, prefs.expandAccepted, prefs.expandIced);
};
