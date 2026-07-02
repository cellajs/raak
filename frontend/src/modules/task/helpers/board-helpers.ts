import type { EnrichedProject } from '~/modules/project/types';
import { type SectionsValue, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { sortTaskOrder } from '~/modules/task/helpers/sort-helpers';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { statusOptions, TaskStatus } from '~/modules/task/task-properties';
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

/** Sort projects by enriched membership displayOrder. */
export const sortByMembership = (projects: EnrichedProject[]) => {
  return [...projects].sort((a, b) => (a.membership?.displayOrder ?? 0) - (b.membership?.displayOrder ?? 0));
};

export const prepareBoardPanels = (boardId: string, projects: EnrichedProject[]) => {
  const { panelData } = useTaskBoardStore.getState();
  const sortedProjects = sortByMembership(projects);

  return sortedProjects.flatMap((project) => {
    const viewSections = panelData[boardId]?.[project.id]?.viewSections;
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
          return `${values.map((status) => statusOptions[status].status).join(', ')}`;
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
 * Reset all task interaction state (selection, focus, draft tasks, open create forms, read-only project ids).
 * Called from route guards on entering / leaving a workspace or project, so stale UI (e.g. the bulk-remove button)
 * never leaks across boards. Adding a new field to `useTaskInteractionStore` is automatically covered as long as
 * it is included in that store's `initialState`.
 */
export const resetTaskInteraction = () => {
  useTaskInteractionStore.getState().reset();
};
