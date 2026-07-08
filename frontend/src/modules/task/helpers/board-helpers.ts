import type { EnrichedProject } from '~/modules/project/types';
import type { BoardPanelData, SectionsValue } from '~/modules/task/board/task-board-store';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { sortTaskOrder } from '~/modules/task/helpers/sort-helpers';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import type { Task } from '~/modules/task/types';

const iced = TaskStatus.Iced;
const accepted = TaskStatus.Accepted;

export const prepareBoardTasks = (tasks: Task[], showAccepted: boolean, showIced: boolean) => {
  return tasks
    .filter(
      ({ status }) =>
        (showAccepted && status === accepted) ||
        (showIced && status === iced) ||
        (status !== accepted && status !== iced),
    )
    .sort(sortTaskOrder);
};

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
 * Whether a board-layout key belongs to a project — either the project's single-panel key
 * (`projectId`) or one of its split-panel keys (`makePanelKey` → `${projectId}-…`). Precise
 * prefix match, unlike a substring test which false-positives when one id is a substring of another.
 */
const layoutKeyBelongsToProject = (layoutKey: string, projectId: string) =>
  layoutKey === projectId || layoutKey.startsWith(`${projectId}-`);

/**
 * Recompute the board-layout widths for a project whose panel is being (re)split into `sections`.
 * `currentViewSections` is the project's existing split (undefined = single panel): when absent the
 * project's keys collapse to one `projectId` entry keeping their total width + position; otherwise the
 * project's width is divided evenly across the new section-panel keys. Pure — the caller persists it.
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

  return sortedProjects.flatMap((project) => {
    const viewSections = boardPanelData?.[project.id]?.viewSections;
    // If the project has no splits, use a default single panel
    if (!viewSections?.length) return [{ project, panelId: project.id }];

    // If split filters exist, create a panel for each status
    return viewSections.map((sectionCriteria) => ({
      project,
      sectionFilters: sectionCriteria,
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
    // Use stored pixel width if available, otherwise fall back to PANEL_MIN_WIDTH (300)
    layout[id] = storedLayout[id] ?? 300;
  }

  return layout;
};

/**
 * Reset all task interaction state (selection, focus, draft tasks) and per-task card view state.
 * Called from route guards on entering / leaving a workspace or project, so stale UI (e.g. the
 * bulk-remove button) never leaks across boards and the card-state map can't grow unbounded.
 * Adding a new field to `useTaskInteractionStore` is automatically covered as long as it is
 * included in that store's `initialState`.
 */
export const resetTaskInteraction = () => {
  useTaskInteractionStore.getState().reset();
  useTaskCardStore.getState().reset();
};
