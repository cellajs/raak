import { useSearch } from '@tanstack/react-router';
import type { Project } from 'sdk';
import { useHotkeys } from '~/hooks/use-hot-keys';
import type { HotkeyItem } from '~/hooks/use-hot-keys-helpers';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { defaultPanelPrefs, type SectionsValue, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import type { DropdownsType } from '~/modules/task/dropdowns/types';
import { cachedTasks, currentActiveTask } from '~/modules/task/helpers/active-task';
import { prepareBoardPanels, prepareBoardTasks } from '~/modules/task/helpers/board-helpers';
import { handleCreateForm as toggleCreateForm } from '~/modules/task/helpers/create-task';
import { setTaskCardFocus } from '~/modules/task/helpers/focus-task';
import { searchFilterFunction } from '~/modules/task/helpers/search-filter';
import { handleTaskDropdownClick } from '~/modules/task/helpers/task-dropdown';
import { isProjectReadOnly } from '~/modules/task/hooks/use-read-only';
import { buildFieldHandlers } from '~/modules/task/hooks/use-task-field-handlers';
import { useTaskUpdateMutation } from '~/modules/task/query';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import type { BoardResizablePanel, Task, TaskSearch } from '~/modules/task/types';
import { useUserStore } from '~/modules/user/user-store';

interface Props {
  boardId: string;
  projects: Project[];
  type: 'workspace' | 'project';
}

type StrictBoardPanel = Required<Pick<BoardResizablePanel, 'project'>> & Omit<BoardResizablePanel, 'project'>;

export function TasksHotkeys({ boardId, projects, type }: Props) {
  const { panelData } = useTaskBoardStore();
  const { tenantId, organization } = useOrganizationLayoutContext();
  const { user } = useUserStore();
  const taskMutation = useTaskUpdateMutation(tenantId, organization.id);

  const search = useSearch({ strict: false }) as TaskSearch;

  const taskSheetId = search.taskSheetId;
  const isSheetOpen = !!taskSheetId;

  // Get filtered visible tasks for a panel
  const getVisiblePanelTasks = (panel: StrictBoardPanel) => {
    const boardTasks = cachedTasks();
    const projectTasks = boardTasks.filter(({ projectId }) => projectId === panel.project.id);
    const searched = projectTasks.filter((task) => searchFilterFunction(search, task));

    const filtered = panel.sectionFilters
      ? searched.filter((task) =>
          Object.entries(panel.sectionFilters!).every(([key, value]) =>
            value.includes(task[key as keyof SectionsValue]),
          ),
        )
      : searched;

    return filtered;
  };

  const findCurrentPanel = (allPanels: StrictBoardPanel[], taskProjectId: string, taskStatus: Task['status']) =>
    allPanels.find(
      ({ project, sectionFilters }) =>
        project.id === taskProjectId && (!sectionFilters || sectionFilters.status.includes(taskStatus)),
    );

  // Resolve the focused task and its panel's rendered task list (shared by vertical nav handlers).
  const resolveVerticalNavContext = () => {
    if (!projects.length) return null;
    const allPanels: StrictBoardPanel[] = prepareBoardPanels(projects, panelData[boardId]);
    const currentTask = currentActiveTask();
    if (!currentTask) return null;

    const currentTaskCard = document.getElementById(currentTask.id);
    if (currentTaskCard?.dataset.state === 'editing') return null;

    const currentPanel = findCurrentPanel(allPanels, currentTask.projectId, currentTask.status) ?? allPanels[0];
    const { expandAccepted, expandIced } = panelData[boardId]?.[currentPanel.project.id]?.prefs || defaultPanelPrefs;
    const visibleTasks = prepareBoardTasks(getVisiblePanelTasks(currentPanel), expandAccepted, expandIced);

    return { currentTask, visibleTasks };
  };

  // Navigate one task up/down within a panel.
  const handleVerticalArrowKeyDown = (event: KeyboardEvent) => {
    const ctx = resolveVerticalNavContext();
    if (!ctx) return;
    const { currentTask, visibleTasks } = ctx;

    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const currentTaskIndex = visibleTasks.findIndex((task) => task.id === currentTask.id);
    const nextTask = visibleTasks[currentTaskIndex + direction];
    if (nextTask) setTaskCardFocus(nextTask.id);
  };

  // Cmd + Up/Down: jump to the first/last task in the column.
  const handleColumnEdgeKeyDown = (event: KeyboardEvent) => {
    const ctx = resolveVerticalNavContext();
    if (!ctx) return;
    const { visibleTasks } = ctx;

    const targetTask = event.key === 'ArrowDown' ? visibleTasks.at(-1) : visibleTasks[0];
    if (targetTask) setTaskCardFocus(targetTask.id);
  };

  // Option + Up/Down: jump to the first task of the next/previous status group. Does nothing at the edges.
  const handleStatusGroupKeyDown = (event: KeyboardEvent) => {
    const ctx = resolveVerticalNavContext();
    if (!ctx) return;
    const { currentTask, visibleTasks } = ctx;

    // visibleTasks are sorted by status, so distinct statuses appear in column order.
    const statusesInOrder = [...new Set(visibleTasks.map((task) => task.status))];
    const currentStatusIndex = statusesInOrder.indexOf(currentTask.status);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const targetStatus = statusesInOrder[currentStatusIndex + direction];
    if (targetStatus === undefined) return; // Already in the first/last status group.

    const targetTask = visibleTasks.find((task) => task.status === targetStatus);
    if (targetTask) setTaskCardFocus(targetTask.id);
  };

  // Find the first task whose card is (partially) visible at the top of the panel's scroll viewport.
  const getFirstViewportTaskId = (projectId: string, visibleTasks: Task[]): string | undefined => {
    const viewport = document.getElementById(`${projectId}-viewport`);
    if (!viewport) return undefined;
    const viewportTop = viewport.getBoundingClientRect().top;
    for (const task of visibleTasks) {
      const card = document.getElementById(task.id);
      if (!card) continue;
      // First card whose bottom edge clears the viewport top is the first (partially) visible task.
      if (card.getBoundingClientRect().bottom > viewportTop + 1) return task.id;
    }
    return undefined;
  };

  // Navigate between panels (Left/Right) — focus the first task visible in the target panel's viewport.
  const handleHorizontalArrowKeyDown = (event: KeyboardEvent) => {
    if (!projects.length) return;
    const allPanels: StrictBoardPanel[] = prepareBoardPanels(projects, panelData[boardId]);
    const currentTask = currentActiveTask();

    const currentPanelIndex = allPanels.findIndex(
      ({ sectionFilters, project }) =>
        project.id === currentTask?.projectId &&
        (!sectionFilters || sectionFilters.status.includes(currentTask.status)),
    );

    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextPanel = allPanels[currentPanelIndex + direction];
    if (!nextPanel) return;

    const { expandAccepted, expandIced } = panelData[boardId]?.[nextPanel.project.id]?.prefs || defaultPanelPrefs;
    const visibleTasks = prepareBoardTasks(getVisiblePanelTasks(nextPanel), expandAccepted, expandIced);
    const targetTaskId = getFirstViewportTaskId(nextPanel.project.id, visibleTasks) ?? visibleTasks[0]?.id;
    if (targetTaskId) setTaskCardFocus(targetTaskId);
  };

  const handleEscKeyPress = () => {
    const task = currentActiveTask(taskSheetId);
    if (!task) return;

    if (document.activeElement instanceof HTMLElement && task.id === document.activeElement.id) {
      document.activeElement.blur();
    }

    if (isSheetOpen) return useSheeter.getState().remove(`taskSheetId-${task.id}`);

    const taskCard = document.getElementById(task.id);
    const state = taskCard?.dataset.state;
    if (state === 'collapsed') return;
    return useTaskCardStore.getState().setTaskState(task.id, state === 'editing' ? 'expanded' : 'collapsed');
  };

  const handleEnterKeyPress = () => {
    const task = currentActiveTask(taskSheetId);
    if (!task) return;

    const taskCard = document.getElementById(isSheetOpen ? `sheet-${task.id}` : task.id);
    const currentState = taskCard?.dataset.state ?? 'collapsed';
    if (isProjectReadOnly(task.projectId) && currentState === 'expanded') return;
    useTaskCardStore.getState().setTaskState(task.id, currentState === 'collapsed' ? 'expanded' : 'editing');
  };

  const handleNKeyDown = () => {
    if (!projects.length) return;
    const { draftTasks } = useTaskInteractionStore.getState();
    const openDraftProjectId = Object.keys(draftTasks)[0];

    let targetProjectId: string | undefined = openDraftProjectId;
    if (!targetProjectId) targetProjectId = currentActiveTask(taskSheetId)?.projectId;

    const targetProject = projects.find((p) => p.id === targetProjectId) ?? projects[0];
    if (isProjectReadOnly(targetProject.id)) return;
    toggleCreateForm(targetProject);
  };

  // Open a field dropdown for the focused task
  const hotKeyPress = (field: DropdownsType) => {
    const targetTask = currentActiveTask(taskSheetId);
    if (!targetTask) return;

    if (isProjectReadOnly(targetTask.projectId)) return;

    const taskCard = document.getElementById(isSheetOpen ? `sheet-${targetTask.id}` : targetTask.id);
    if (!taskCard) return;
    if (document.activeElement !== taskCard) taskCard.focus();

    const triggerId = `${field}-${targetTask.id}${isSheetOpen ? '-sheet' : ''}`;
    const trigger = taskCard.querySelector(`#${triggerId}`);
    if (!(trigger instanceof HTMLButtonElement)) return useDropdowner.getState().remove();

    const handlers = buildFieldHandlers(targetTask, { taskMutation, user });
    const base = { triggerId, triggerRef: { current: trigger }, taskId: targetTask.id };

    // A switch keeps each call matched to the right discriminated-union member — no cast.
    switch (field) {
      case 'points':
        return handleTaskDropdownClick({
          ...base,
          dropdownType: 'points',
          value: targetTask.points,
          onChange: handlers.onPointsChange,
        });
      case 'labels':
        return handleTaskDropdownClick({
          ...base,
          dropdownType: 'labels',
          value: targetTask.labels,
          projectId: targetTask.projectId,
          onChange: handlers.onLabelsChange,
        });
      case 'assignedTo':
        return handleTaskDropdownClick({
          ...base,
          dropdownType: 'assignedTo',
          value: targetTask.assignedTo,
          projectId: targetTask.projectId,
          onChange: handlers.onAssignedToChange,
        });
      case 'status':
        return handleTaskDropdownClick({
          ...base,
          dropdownType: 'status',
          value: targetTask.status,
          onChange: handlers.onStatusChange,
        });
      case 'variant':
        return handleTaskDropdownClick({
          ...base,
          dropdownType: 'variant',
          value: targetTask.variant,
          onChange: handlers.onVariantChange,
        });
    }
  };

  const actionHotkeys: HotkeyItem[] = [
    ['A', () => hotKeyPress('assignedTo')],
    ['I', () => hotKeyPress('points')],
    ['L', () => hotKeyPress('labels')],
    ['S', () => hotKeyPress('status')],
    ['T', () => hotKeyPress('variant')],
    ['N', handleNKeyDown],
  ];

  const stateHotkeys: HotkeyItem[] = [
    ['Escape', handleEscKeyPress],
    ['Enter', handleEnterKeyPress],
  ];

  const boardNavHotkeys: HotkeyItem[] = [
    ['ArrowRight', handleHorizontalArrowKeyDown],
    ['ArrowLeft', handleHorizontalArrowKeyDown],
  ];

  const panelNavHotkeys: HotkeyItem[] = [
    ['ArrowDown', handleVerticalArrowKeyDown],
    ['ArrowUp', handleVerticalArrowKeyDown],
    ['meta + ArrowDown', handleColumnEdgeKeyDown],
    ['meta + ArrowUp', handleColumnEdgeKeyDown],
    ['alt + ArrowDown', handleStatusGroupKeyDown],
    ['alt + ArrowUp', handleStatusGroupKeyDown],
  ];

  const gridIgnoreTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', '[role="grid"]'];

  const coreHotkeys = [...stateHotkeys, ...actionHotkeys];
  useHotkeys(coreHotkeys, gridIgnoreTags);

  const navHotkeys = isSheetOpen
    ? []
    : type === 'workspace'
      ? [...boardNavHotkeys, ...panelNavHotkeys]
      : panelNavHotkeys;
  useHotkeys(navHotkeys, gridIgnoreTags);

  return null;
}
