import i18n from 'i18next';
import { panelMinWidth } from '~/modules/common/board/board-layout';
import type { EnrichedProject } from '~/modules/project/types';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import type { BoardPanelData, SectionsValue, TogglableStatusType } from '~/modules/task/board/task-board-store';
import { taskCardStore } from '~/modules/task/card/task-card-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { matchesBoardSearch } from '~/modules/task/helpers/search-filter';
import { compareTaskOrder } from '~/modules/task/helpers/sort-helpers';
import { taskInteractionStore } from '~/modules/task/task-interaction-store';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import type { BoardSearchParams, ProjectResizablePanel, Task, TaskCounts } from '~/modules/task/types';

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

/** The split section hosting a project's create-form draft: the one matching its status, else the first. Null for an unsplit project. */
export const resolveDraftHostSection = (viewSections: SectionsValue[] | undefined, status: Task['status']) => {
  if (!viewSections?.length) return null;
  return viewSections.find((section) => section.status.includes(status)) ?? viewSections[0];
};

/** Whether this panel is the project's primary one: the unsplit panel, or the first split section. */
export const isPrimarySection = (viewSections: SectionsValue[] | undefined, sectionFilters: SectionsValue | undefined) =>
  !viewSections?.length || viewSections[0] === sectionFilters;

/** Whether this panel hosts the create-form draft of a status; every panel of an unsplit project does. */
export const panelHostsDraft = (viewSections: SectionsValue[] | undefined, projectId: string, panelId: string, status: Task['status']) => {
  const hostSection = resolveDraftHostSection(viewSections, status);
  return !hostSection || makePanelKey(projectId, hostSection) === panelId;
};

/** Whether a task's status is one of a split panel's sections. */
export const inSections = (task: Task, sectionFilters: SectionsValue) => sectionFilters.status.includes(task.status);

export const makePanelKey = (projectId: string, section: SectionsValue) => {
  const keyParts = Object.entries(section)
    .map(([key, values]) => {
      const normalizedValues = values.map((value) => String(value).toLowerCase()).join('-');
      return `${key}-${normalizedValues}`;
    })
    .join('__'); // double underscore separates categories, e.g. status__impact

  return `${projectId}-${keyParts}`;
};

// Exact prefixes keep one project's id from matching another that contains it
const layoutKeyBelongsToProject = (layoutKey: string, projectId: string) => layoutKey === projectId || layoutKey.startsWith(`${projectId}-`);

/** Panel widths after a project's sections change: a single panel keeps the total width and position, split panels share it evenly. */
export const computePanelLayoutSplit = (
  layout: Record<string, number>,
  projectId: string,
  sections: SectionsValue[],
  currentViewSections: SectionsValue[] | undefined,
): Record<string, number> => {
  const layoutArray = Object.entries(layout);

  if (!currentViewSections) {
    const insertIndex = layoutArray.findIndex(([key]) => layoutKeyBelongsToProject(key, projectId));
    const totalSize = layoutArray.reduce((sum, [key, size]) => (layoutKeyBelongsToProject(key, projectId) ? sum + size : sum), 0);
    const filtered = layoutArray.filter(([key]) => !layoutKeyBelongsToProject(key, projectId));
    filtered.splice(insertIndex, 0, [projectId, totalSize]);
    return Object.fromEntries(filtered);
  }

  const updated = layoutArray.flatMap(([key, size]): [string, number][] => {
    if (!layoutKeyBelongsToProject(key, projectId)) return [[key, size]];
    const percentagePart = size / currentViewSections.length;
    return sections.map((sectionFilters): [string, number] => [makePanelKey(projectId, sectionFilters), percentagePart]);
  });
  return Object.fromEntries(updated);
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

export const prepareBoardPanels = (projects: EnrichedProject[], viewSectionsByProject: BoardViewSections) => {
  const sortedProjects = sortByMembership(projects);

  return sortedProjects.flatMap((project): ProjectResizablePanel[] => {
    const viewSections = viewSectionsByProject[project.id];
    if (!viewSections?.length) return [{ kind: 'project', project, panelId: project.id }];

    return viewSections.map((sectionCriteria, sectionIndex) => ({
      kind: 'project',
      project,
      sectionFilters: sectionCriteria,
      sectionIndex,
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

export const formatSectionLabel = (filters: SectionsValue): string => {
  return Object.entries(filters)
    .map(([key, values]) => {
      switch (key) {
        case 'status':
          return values.map((status) => i18n.t(`c:${statusOptionsByValue[status].status}`)).join(', ');
        default:
          return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${values.join(', ')}`;
      }
    })
    .join('\n');
};

export const normalizePanelWidths = (storedLayout: Record<string, number>, currentProjectIds: string[]) => {
  const layout: Record<string, number> = {};

  for (const id of currentProjectIds) {
    layout[id] = storedLayout[id] ?? panelMinWidth;
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
