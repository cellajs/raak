import i18n from 'i18next';
import type { TKey } from '~/lib/i18n-locales';
import { collapsedPanelMinWidth, panelMinWidth } from '~/modules/common/board/board-layout';
import type { ProjectWithMembership } from '~/modules/project/types';
import { useBoardFocusStore } from '~/modules/task/board/board-focus-store';
import type { TogglableStatusType } from '~/modules/task/board/task-board-store';
import { taskCardStore } from '~/modules/task/card/task-card-store';
import { isDraftTask } from '~/modules/task/helpers/draft-task';
import { compareTaskOrder } from '~/modules/task/helpers/sort-helpers';
import { taskInteractionStore } from '~/modules/task/task-interaction-store';
import { TaskStatus } from '~/modules/task/task-properties';
import type { BoardResizablePanel, ProjectPageGroup, ProjectResizablePanel, Task, TaskCounts } from '~/modules/task/types';

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

export const sortByMembership = (projects: ProjectWithMembership[]) => {
  return [...projects].sort((a, b) => (a.membership?.displayOrder ?? 0) - (b.membership?.displayOrder ?? 0));
};

/** Orders tasks as the board shows them: panels by membership, on a project page by its panels, then status and display order. */
export const sortTasksAsOnBoard = (tasks: Task[], projects: ProjectWithMembership[], projectPage = false) => {
  const panelIndex = new Map(sortByMembership(projects).map((project, index) => [project.id, index]));
  const pageIndex = (task: Task) => (projectPage ? groupIndex(task.status) : 0);
  return [...tasks].sort(
    (a, b) => (panelIndex.get(a.projectId) ?? 0) - (panelIndex.get(b.projectId) ?? 0) || pageIndex(a) - pageIndex(b) || compareTaskOrder(a, b),
  );
};

interface ProjectPageGroupInfo {
  group: ProjectPageGroup;
  /** In flow order, as the header's icons read left to right; the arrays are stable, so a phone tab switch alone re-renders the panel. */
  statuses: TaskStatus[];
  /** The status a task created from this panel's phone tab starts in. */
  entry: TaskStatus;
  /** What the panel says while it lists nothing. */
  emptyTitle: TKey;
}

/** The project page's panels in flow order: its desktop panels and its phone tabs. */
export const projectPageGroups: ProjectPageGroupInfo[] = [
  { group: 'to_do', statuses: [iced, TaskStatus.Unstarted], entry: TaskStatus.Unstarted, emptyTitle: 'c:nothing_to_do' },
  {
    group: 'in_progress',
    statuses: [TaskStatus.Started, TaskStatus.Finished, TaskStatus.Reviewed],
    entry: TaskStatus.Started,
    emptyTitle: 'c:nothing_in_progress',
  },
  { group: 'done', statuses: [accepted], entry: accepted, emptyTitle: 'c:nothing_done_recently' },
];

/** A project page panel by its group, as a panel or the phone's tab param names it. */
export const findProjectPageGroup = (group?: string) => projectPageGroups.find((info) => info.group === group);

const groupIndex = (status: TaskStatus) => projectPageGroups.findIndex(({ statuses }) => statuses.includes(status));

const groupPanelId = (projectId: string, group: ProjectPageGroup) => `${projectId}-${group}`;

/** The id of the project page panel that lists this status. */
export const projectPagePanelId = (projectId: string, status: TaskStatus) => groupPanelId(projectId, projectPageGroups[groupIndex(status)].group);

/** One panel per project on a workspace board; on a project page, the project's To do, In progress and Done. */
export const prepareBoardPanels = (projects: ProjectWithMembership[], projectPage = false) =>
  sortByMembership(projects).flatMap((project): ProjectResizablePanel[] =>
    projectPage
      ? projectPageGroups.map(({ group, statuses }) => ({ kind: 'project', project, panelId: groupPanelId(project.id, group), statuses, group }))
      : [{ kind: 'project', project, panelId: project.id }],
  );

/** Whether a panel lists every status, which is the one panel that folds accepted and iced into bars. */
export const listsEveryStatus = (statuses: TaskStatus[] | undefined) => !statuses;

/** A panel's name: its project's, or on a project page its group's. */
export const projectPanelName = (project: { name: string }, group?: ProjectPageGroup) => (group ? i18n.t(`c:${group}`) : project.name);

export const sectionBarId = (type: TogglableStatusType, projectId: string) => `section-${type}-${projectId}`;

/** Whether a panel folds this status into a bar at all, tasks or not. */
export const foldsSection = (type: TogglableStatusType, counts: TaskCounts) => (type === 'iced' ? counts.showIced : counts.showAccepted);

/** Whether a panel shows the accepted or iced bar: accepted also for older accepted tasks beyond the cut-off alone. */
export const hasSectionBar = (type: TogglableStatusType, counts: TaskCounts) =>
  type === 'iced' ? counts.showIced && !!counts.iced : counts.showAccepted && (!!counts.accepted || counts.acceptedCutOff > 0);

/** The stored width of each panel, else its default: collapsed for those in `startCollapsed`, the minimum for the rest. */
export const normalizePanelWidths = (storedLayout: Record<string, number>, panels: BoardResizablePanel[], startCollapsed: string[] = []) =>
  Object.fromEntries(
    panels.map(({ panelId }) => [panelId, storedLayout[panelId] ?? (startCollapsed.includes(panelId) ? collapsedPanelMinWidth : panelMinWidth)]),
  );

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
