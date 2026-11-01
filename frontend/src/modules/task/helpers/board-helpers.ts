import i18n from 'i18next';
import { panelMinWidth } from '~/modules/common/board/board-layout';
import type { EnrichedProject } from '~/modules/project/types';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import type { TogglableStatusType } from '~/modules/task/board/task-board-store';
import { taskCardStore } from '~/modules/task/card/task-card-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { compareTaskOrder } from '~/modules/task/helpers/sort-helpers';
import { taskInteractionStore } from '~/modules/task/task-interaction-store';
import { statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import type { BoardResizablePanel, ProjectResizablePanel, Task, TaskCounts } from '~/modules/task/types';

const iced = TaskStatus.Iced;
const accepted = TaskStatus.Accepted;

/** Board tasks in order; the open create-form draft is exempt from the accepted/iced collapse. */
export const prepareBoardTasks = (tasks: Task[], showAccepted: boolean, showIced: boolean) =>
  tasks
    .filter(
      (task) =>
        isDraftTask(task) ||
        (showAccepted && task.status === accepted) ||
        (showIced && task.status === iced) ||
        (task.status !== accepted && task.status !== iced),
    )
    .sort(compareTaskOrder);

export const sortByMembership = (projects: EnrichedProject[]) => {
  return [...projects].sort((a, b) => (a.membership?.displayOrder ?? 0) - (b.membership?.displayOrder ?? 0));
};

/** Orders tasks as the board shows them: panels by membership, then status and display order. */
export const sortTasksAsOnBoard = (tasks: Task[], projects: EnrichedProject[]) => {
  const panelIndex = new Map(sortByMembership(projects).map((project, index) => [project.id, index]));
  return [...tasks].sort((a, b) => (panelIndex.get(a.projectId) ?? 0) - (panelIndex.get(b.projectId) ?? 0) || compareTaskOrder(a, b));
};

// The path a task takes, with iced off the end of it. Panel titles read in this order.
export const statusPath: TaskStatus[] = [
  TaskStatus.Unstarted,
  TaskStatus.Started,
  TaskStatus.Finished,
  TaskStatus.Delivered,
  TaskStatus.Reviewed,
  accepted,
  iced,
];

/** The statuses as a panel lists them from the bottom up, iced first: the order of the mobile tabs. */
export const statusesBottomUp = statusPath.toSorted((a, b) => b - a);

/** The mobile status tabs by their search param. The lists are stable, so a tab switch alone re-renders the memoized panel. */
export const statusTabLists = new Map<string, TaskStatus[]>(statusPath.map((status) => [statusOptionsByValue[status].status, [status]]));

/** A status panel's place on a board that starts with this status. */
const statusListIndex = (status: TaskStatus, startWith: TogglableStatusType) => (startWith === 'iced' ? iced - status : status);

/** The panel id of a status with a panel of its own. */
export const statusPanelId = (projectId: string, status: TaskStatus) => `${projectId}-status-${statusOptionsByValue[status].status}`;

/** One panel per project; on a board with status panels, the project's panel keeps the statuses left over. Status panels line up from the status the board starts with, and the project's panel follows them. */
export const prepareBoardPanels = (projects: EnrichedProject[], statusPanels: TaskStatus[] = [], startWith: TogglableStatusType = 'accepted') =>
  sortByMembership(projects).flatMap((project): ProjectResizablePanel[] => {
    const panel: ProjectResizablePanel = { kind: 'project', project, panelId: project.id };
    if (!statusPanels.length) return [panel];

    const leftOver = statusPath.filter((status) => !statusPanels.includes(status));
    return [
      ...(leftOver.length ? [{ ...panel, statuses: leftOver, orderOffset: iced + 1 }] : []),
      ...statusPanels.map((status) => ({
        ...panel,
        panelId: statusPanelId(project.id, status),
        statuses: [status],
        orderOffset: statusListIndex(status, startWith),
      })),
    ];
  });

/** Whether a panel folds this status into a bar: when it lists the status among others. */
export const foldsStatus = (statuses: TaskStatus[] | undefined, status: TaskStatus) =>
  !statuses || (statuses.length > 1 && statuses.includes(status));

const statusNames = (statuses: TaskStatus[]) => statuses.map((status) => i18n.t(`c:${statusOptionsByValue[status].status}`));

/** Every status of a panel by name, where its title abbreviates them. */
export const listStatusNames = (statuses: TaskStatus[]) => statusNames(statuses).join(', ');

/** A panel's title: "Started" for one status, "Backlog and iced" for two, "Finished … accepted" for more. Its icons tell which are in between. */
export const formatStatusesLabel = (statuses: TaskStatus[]): string => {
  const names = statusNames(statuses);
  if (names.length < 2) return names.join();

  const first = names[0];
  const last = names[names.length - 1].toLowerCase();
  return names.length === 2 ? i18n.t('c:status_pair', { first, second: last }) : i18n.t('c:status_range', { from: first, to: last });
};

/** A project panel's name: the project, and for a panel of some statuses those too. */
export const projectPanelName = (project: { name: string }, statuses?: TaskStatus[]) =>
  statuses ? `${project.name}: ${formatStatusesLabel(statuses)}` : project.name;

export const sectionBarId = (type: TogglableStatusType, projectId: string) => `section-${type}-${projectId}`;

/** Whether a panel folds this status into a bar at all, tasks or not. */
export const foldsSection = (type: TogglableStatusType, counts: TaskCounts) => (type === 'iced' ? counts.showIced : counts.showAccepted);

/** Whether a panel shows the accepted or iced bar: accepted also for older accepted tasks beyond the cut-off alone. */
export const hasSectionBar = (type: TogglableStatusType, counts: TaskCounts) =>
  type === 'iced' ? counts.showIced && !!counts.iced : counts.showAccepted && (!!counts.accepted || counts.acceptedCutOff > 0);

export const normalizePanelWidths = (storedLayout: Record<string, number>, panels: BoardResizablePanel[]) =>
  Object.fromEntries(panels.map(({ panelId }) => [panelId, storedLayout[panelId] ?? panelMinWidth]));

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
