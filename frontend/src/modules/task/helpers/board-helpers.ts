import { PANEL_MIN_WIDTH } from '~/modules/common/board/board-layout';
import type { EnrichedProject } from '~/modules/project/types';
import type { BoardPanelData, SectionsValue } from '~/modules/task/board/task-board-store';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { sortTaskOrder } from '~/modules/task/helpers/sort-helpers';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import type { ProjectResizablePanel, Task } from '~/modules/task/types';

const iced = TaskStatus.Iced;
const accepted = TaskStatus.Accepted;

/** Prepares board tasks. The open create-form draft is exempt from the accepted/iced collapse. */
export const prepareBoardTasks = (tasks: Task[], showAccepted: boolean, showIced: boolean) => {
  return tasks
    .filter(
      (task) =>
        isDraftTask(task) ||
        (showAccepted && task.status === accepted) ||
        (showIced && task.status === iced) ||
        (task.status !== accepted && task.status !== iced),
    )
    .sort(sortTaskOrder);
};

/**
 * Picks the split section that hosts a project's create-form draft: the section matching the
 * draft's status, else the first. Guarantees exactly one panel renders the open form even when
 * no section filter matches. Returns null for an unsplit project (its single panel hosts).
 */
export const resolveDraftHostSection = (viewSections: SectionsValue[] | undefined, status: Task['status']) => {
  if (!viewSections?.length) return null;
  return viewSections.find((section) => section.status.includes(status)) ?? viewSections[0];
};

/** Builds the stable state key for a board panel. */
export const makePanelKey = (projectId: string, section: SectionsValue) => {
  const keyParts = Object.entries(section)
    .map(([key, values]) => {
      // Ensure consistent, lowercase-safe key format
      const normalizedValues = values.map((v) => String(v).toLowerCase()).join('-');
      return `${key}-${normalizedValues}`;
    })
    .join('__'); // double underscore separates categories, e.g. status__impact

  return `${projectId}-${keyParts}`;
};

/**
 * Checks whether a board-layout key identifies a project's base or split panel.
 * Exact prefixes prevent collisions between IDs containing one another.
 */
const layoutKeyBelongsToProject = (layoutKey: string, projectId: string) =>
  layoutKey === projectId || layoutKey.startsWith(`${projectId}-`);

/**
 * Recomputes project panel widths after sections change.
 * A single panel retains total width and position; split panels divide that width evenly.
 */
export const computePanelLayoutSplit = (
  layout: Record<string, number>,
  projectId: string,
  sections: SectionsValue[],
  currentViewSections: SectionsValue[] | undefined,
): Record<string, number> => {
  const layoutArray = Object.entries(layout);

  if (!currentViewSections) {
    const insertIndex = layoutArray.findIndex(([key]) => layoutKeyBelongsToProject(key, projectId));
    const totalSize = layoutArray.reduce(
      (sum, [key, size]) => (layoutKeyBelongsToProject(key, projectId) ? sum + size : sum),
      0,
    );
    const filtered = layoutArray.filter(([key]) => !layoutKeyBelongsToProject(key, projectId));
    filtered.splice(insertIndex, 0, [projectId, totalSize]);
    return Object.fromEntries(filtered);
  }

  const updated = layoutArray.flatMap(([key, size]): [string, number][] => {
    if (!layoutKeyBelongsToProject(key, projectId)) return [[key, size]];
    const percentagePart = size / currentViewSections.length;
    return sections.map((sectionFilters): [string, number] => [
      makePanelKey(projectId, sectionFilters),
      percentagePart,
    ]);
  });
  return Object.fromEntries(updated);
};

/** Sort projects by enriched membership displayOrder. */
export const sortByMembership = (projects: EnrichedProject[]) => {
  return [...projects].sort((a, b) => (a.membership?.displayOrder ?? 0) - (b.membership?.displayOrder ?? 0));
};

export const prepareBoardPanels = (projects: EnrichedProject[], boardPanelData: BoardPanelData | undefined) => {
  const sortedProjects = sortByMembership(projects);

  return sortedProjects.flatMap((project): ProjectResizablePanel[] => {
    const viewSections = boardPanelData?.[project.id]?.viewSections;
    // If the project has no splits, use a default single panel
    if (!viewSections?.length) return [{ kind: 'project', project, panelId: project.id }];

    // If split filters exist, create a panel for each status
    return viewSections.map((sectionCriteria, sectionIndex) => ({
      kind: 'project',
      project,
      sectionFilters: sectionCriteria,
      sectionIndex,
      panelId: makePanelKey(project.id, sectionCriteria),
    }));
  });
};

export const formatSectionLabel = (filters: SectionsValue): string => {
  return Object.entries(filters)
    .map(([key, values]) => {
      switch (key) {
        case 'status':
          return `${values.map((status) => statusOptionsByValue[status].status).join(', ')}`;
        default:
          return `${key.charAt(0).toUpperCase() + key.slice(1)}: ${values.join(', ')}`;
      }
    })
    .join('\n');
};

export const normalizePanelWidths = (storedLayout: Record<string, number>, currentProjectIds: string[]) => {
  const layout: Record<string, number> = {};

  for (const id of currentProjectIds) {
    // Use stored pixel width if available, otherwise fall back to the panel minimum width
    layout[id] = storedLayout[id] ?? PANEL_MIN_WIDTH;
  }

  return layout;
};

/** Board identity of the last `resetTaskInteraction` call, to skip same-board re-entries. */
let lastInteractionBoardKey: string | null = null;

/**
 * Reset all task interaction state (selection, focus, draft tasks) and per-task card view state.
 * Called from route guards on entering / leaving a workspace or project, so stale UI (e.g. the
 * floating selection bar) never leaks across boards and the card-state map can't grow unbounded.
 * `beforeLoad` also reruns on search-param-only navigations (e.g. typing in board search); pass
 * the board's `boardKey` so those same-board re-entries keep the selection. Calling without a
 * key (route `onLeave`) always resets. Adding a new field to `useTaskInteractionStore` is
 * automatically covered as long as it is included in that store's `initialState`.
 */
export const resetTaskInteraction = (boardKey?: string) => {
  if (boardKey && boardKey === lastInteractionBoardKey) return;
  lastInteractionBoardKey = boardKey ?? null;
  useTaskInteractionStore.getState().reset();
  useTaskCardStore.getState().reset();
};
