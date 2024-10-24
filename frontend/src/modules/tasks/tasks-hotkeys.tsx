import { useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useHotkeys } from '~/hooks/use-hot-keys';
import type { HotkeyItem } from '~/hooks/use-hot-keys-helpers';
import { dispatchCustomEvent } from '~/lib/custom-events';
import { queryClient } from '~/lib/router';
import { dropdowner } from '~/modules/common/dropdowner/state';
import { taskKeys } from '~/modules/common/query-client-provider/tasks';
import { handleTaskDropDownClick, setTaskCardFocus, sortTaskOrder } from '~/modules/tasks/helpers';
import { WorkspaceRoute } from '~/routes/workspaces';
import { useWorkspaceStore } from '~/store/workspace';
import { defaultColumnValues, useWorkspaceUIStore } from '~/store/workspace-ui';
import type { Task } from '~/types/app';
import { useWorkspaceQuery } from '../workspaces/helpers/use-workspace';

interface HotkeysManagerProps {
  mode: 'sheet' | 'board';
}

type QueryData = {
  items: Task[];
  total: number;
};

type InfiniteQueryData = {
  pageParams: number[];
  pages: QueryData[];
};

const getSortedColumnTasks = (tasks: Task[], showAccepted: boolean, showIced: boolean) => {
  return tasks
    .filter((t) => (showAccepted && t.status === 6) || (showIced && t.status === 0) || (t.status !== 0 && t.status !== 6))
    .sort((a, b) => sortTaskOrder(a, b));
};
export default function TasksHotkeysManager({ mode }: HotkeysManagerProps) {
  const {
    data: { workspace, projects: queryProjects },
  } = useWorkspaceQuery();

  // TODO maybe find other way
  const projects = useMemo(
    () => queryProjects.filter((p) => !p.membership?.archived).sort((a, b) => (a.membership?.order ?? 0) - (b.membership?.order ?? 0)),
    [queryProjects],
  );

  const { focusedTaskId: storeFocused } = useWorkspaceStore();
  const { taskIdPreview } = useSearch({ from: WorkspaceRoute.id });

  const { workspaces, changeColumn } = useWorkspaceUIStore();

  const queries = queryClient.getQueriesData<QueryData | InfiniteQueryData>({ queryKey: taskKeys.lists() });
  // Retrieve all tasks
  const tasks = useMemo(() => {
    return queries.flatMap(([_, data]) => {
      return (data && 'pages' in data ? data?.pages[0].items : data?.items) ?? [];
    });
  }, [queries]);

  const { currentTask, isSheetOpen } = useMemo(() => {
    const currentTask = tasks.find((t) => t.id === (taskIdPreview || storeFocused));
    return { currentTask, isSheetOpen: !!taskIdPreview };
  }, [taskIdPreview, storeFocused, tasks]);

  //handles Arrow Up/Down to navigate between tasks within a project
  const handleVerticalArrowKeyDown = (event: KeyboardEvent) => {
    if (!projects.length) return;
    const taskCard = document.getElementById(currentTask?.id || '');
    const state = taskCard?.dataset.state;
    if (state === 'editing' || state === 'unsaved') return;

    const direction = currentTask?.id ? (event.key === 'ArrowDown' ? 1 : -1) : 0;

    // Get currently focused project
    const currentProject = projects.find((p) => p.id === currentTask?.projectId) ?? projects[0];

    // Extract project settings
    const { expandAccepted, expandIced } = workspaces[workspace.id]?.columns[currentProject.id] || defaultColumnValues;

    // Filter and sort tasks for the current project
    const projectTasks = tasks.filter((t) => t.projectId === currentProject.id);
    const filteredTasks = getSortedColumnTasks(projectTasks, expandAccepted, expandIced);

    const taskIndex = currentTask?.id ? filteredTasks.findIndex((t) => t.id === currentTask?.id) : 0;
    // Ensure the next task in the direction exists
    const nextTask = filteredTasks[taskIndex + direction];
    if (!nextTask) return;

    setTaskCardFocus(nextTask.id);
  };

  //handles Arrow Left/Right to navigate between projects
  const handleHorizontalArrowKeyDown = (event: KeyboardEvent) => {
    if (!projects.length || !currentTask) return;

    // Get the currently project index
    const currentProjectIndex = projects.findIndex((p) => p.id === currentTask?.projectId);

    // Determine the next project based on the arrow key pressed
    const nextProjectIndex = event.key === 'ArrowRight' ? currentProjectIndex + 1 : currentProjectIndex - 1;
    const nextProject = projects[nextProjectIndex];

    if (!nextProject) return;

    // Get project info and filter tasks
    const projectTasks = tasks.filter((t) => t.projectId === nextProject.id);
    const { expandAccepted } = workspaces[workspace.id]?.columns[nextProject.id] || defaultColumnValues;

    const [firstTask] = getSortedColumnTasks(projectTasks, expandAccepted, false);
    if (!firstTask) return;

    // Set focus on the first task of the project
    setTaskCardFocus(firstTask.id);
  };

  // handles fold or stop editing tasks, subtasks, and hide of creation todo
  const handleEscKeyPress = () => {
    if (!currentTask) return;

    // check if creation of subtask open
    const subtaskCreation = !!document.getElementById('create-subtask');
    if (subtaskCreation) return;

    // check if creation of subtask open or  some of the subtasks editing
    const subtasksEditing = document.querySelectorAll(`[id^="blocknote-subtask-"]`);
    if (subtasksEditing.length) return dispatchCustomEvent('changeSubtaskState', { taskId: currentTask.id, state: 'removeEditing' });

    const taskCard = document.getElementById(currentTask.id);
    const state = taskCard?.dataset.state;
    if (state === 'folded') {
      // check if creation of task open
      const taskCreation = document.getElementById(`create-task-${currentTask.projectId}`);
      if (taskCreation) return changeColumn(workspace.id, currentTask.projectId, { createTaskForm: false });
    }

    if (state === 'editing' || state === 'unsaved') return dispatchCustomEvent('changeTaskState', { taskId: currentTask.id, state: 'expanded' });

    if (state === 'expanded') return dispatchCustomEvent('changeTaskState', { taskId: currentTask.id, state: 'folded' });
  };

  //handles expand or start editing a task
  const handleEnterKeyPress = () => {
    if (!currentTask) return;
    const taskCard = document.getElementById(currentTask.id);
    const state = taskCard?.dataset.state;

    if (state === 'folded') dispatchCustomEvent('changeTaskState', { taskId: currentTask.id, state: 'expanded' });
    if (state === 'expanded') dispatchCustomEvent('changeTaskState', { taskId: currentTask.id, state: 'editing' });
  };

  // handles toggling task creation form for the current project or the first project in the array if no current project
  const handleNKeyDown = () => {
    if (!projects.length) return;

    const project = projects.find((p) => p.id === currentTask?.projectId) || projects[0];
    const projectSettings = workspaces[workspace.id]?.columns[project.id] || defaultColumnValues;
    changeColumn(workspace.id, project.id, { createTaskForm: !projectSettings.createTaskForm });
  };

  // handles hotkey press events to trigger a dropdown for a specific task field
  const hotKeyPress = (field: string) => {
    if (!currentTask) return;

    const taskCard = document.getElementById(isSheetOpen ? `sheet-card-${currentTask.id}` : currentTask.id);
    if (!taskCard) return;

    if (document.activeElement !== taskCard) taskCard.focus();

    const trigger = taskCard?.querySelector(`#${field}-${currentTask.id}`);
    if (!trigger) return dropdowner.remove();

    handleTaskDropDownClick(currentTask, field, trigger as HTMLElement);
  };

  const defaultHotKeys: HotkeyItem[] = [
    ['A', () => hotKeyPress('assignedTo')],
    ['I', () => hotKeyPress('impact')],
    ['L', () => hotKeyPress('labels')],
    ['S', () => hotKeyPress('status')],
    ['T', () => hotKeyPress('type')],
  ];
  const boardHotKeys: HotkeyItem[] = [
    ['ArrowRight', handleHorizontalArrowKeyDown],
    ['ArrowLeft', handleHorizontalArrowKeyDown],
    ['ArrowDown', handleVerticalArrowKeyDown],
    ['ArrowUp', handleVerticalArrowKeyDown],
    ['Escape', handleEscKeyPress],
    ['Enter', handleEnterKeyPress],
    ['N', handleNKeyDown],
  ];

  // Register hotkeys based on mode
  const hotkeysToUse = mode === 'board' ? (isSheetOpen ? boardHotKeys : [...boardHotKeys, ...defaultHotKeys]) : defaultHotKeys;
  useHotkeys(hotkeysToUse);

  return null; // No UI, this component only handles hotkeys
}
