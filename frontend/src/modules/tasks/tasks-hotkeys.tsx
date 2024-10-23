import { useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useHotkeys } from '~/hooks/use-hot-keys';
import type { HotkeyItem } from '~/hooks/use-hot-keys-helpers';
import { dispatchCustomEvent } from '~/lib/custom-events';
import { queryClient } from '~/lib/router';
import { dropdowner } from '~/modules/common/dropdowner/state';
import { taskKeys } from '~/modules/common/query-client-provider/tasks';
import { handleTaskDropDownClick, setTaskCardFocus, sortAndGetCounts } from '~/modules/tasks/helpers';
import { WorkspaceRoute } from '~/routes/workspaces';
import { useWorkspaceStore } from '~/store/workspace';
import { defaultColumnValues, useWorkspaceUIStore } from '~/store/workspace-ui';
import type { Project, Task } from '~/types/app';

interface HotkeysManagerProps {
  workspaceId: string;
  projects: Project[];
  mode: 'default' | 'board';
}

type QueryData = {
  items: Task[];
  total: number;
};

type InfiniteQueryData = {
  pageParams: number[];
  pages: QueryData[];
};

export default function TasksHotkeysManager({ workspaceId, projects, mode = 'default' }: HotkeysManagerProps) {
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

  const currentTask = useMemo(() => tasks.find((t) => t.id === (taskIdPreview || storeFocused)), [taskIdPreview, storeFocused, tasks]);

  const handleVerticalArrowKeyDown = (event: KeyboardEvent) => {
    if (!projects.length) return;
    const taskCard = document.getElementById(currentTask?.id || '');
    const state = taskCard?.dataset.state;
    if (state === 'editing' || state === 'unsaved') return;

    const direction = currentTask?.id ? (event.key === 'ArrowDown' ? 1 : -1) : 0;

    // Get currently focused project
    const currentProject = projects.find((p) => p.id === currentTask?.projectId) ?? projects[0];

    // Extract project settings
    const { expandAccepted, expandIced } = workspaces[workspaceId]?.[currentProject.id] || defaultColumnValues;

    // Filter and sort tasks for the current project
    const projectTasks = tasks.filter((t) => t.projectId === currentProject.id);
    const { filteredTasks } = sortAndGetCounts(projectTasks, expandAccepted, expandIced);

    const taskIndex = currentTask?.id ? filteredTasks.findIndex((t) => t.id === currentTask?.id) : 0;
    // Ensure the next task in the direction exists
    const nextTask = filteredTasks[taskIndex + direction];
    if (!nextTask) return;

    setTaskCardFocus(nextTask.id);
  };

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
    const { expandAccepted } = workspaces[workspaceId]?.[nextProject.id] || defaultColumnValues;

    const [firstTask] = sortAndGetCounts(projectTasks, expandAccepted, false).filteredTasks;
    if (!firstTask) return;

    // Set focus on the first task of the project
    setTaskCardFocus(firstTask.id);
  };

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
      if (taskCreation) return changeColumn(workspaceId, currentTask.projectId, { createTaskForm: false });
    }

    if (state === 'editing' || state === 'unsaved') return dispatchCustomEvent('changeTaskState', { taskId: currentTask.id, state: 'expanded' });

    if (state === 'expanded') return dispatchCustomEvent('changeTaskState', { taskId: currentTask.id, state: 'folded' });
  };

  const handleEnterKeyPress = () => {
    if (!currentTask) return;
    const taskCard = document.getElementById(currentTask.id);
    const state = taskCard?.dataset.state;

    if (state === 'folded') dispatchCustomEvent('changeTaskState', { taskId: currentTask.id, state: 'expanded' });
    if (state === 'expanded') dispatchCustomEvent('changeTaskState', { taskId: currentTask.id, state: 'editing' });
  };

  const handleNKeyDown = () => {
    if (!projects.length || !currentTask) return;

    const project = projects.find((p) => p.id === currentTask?.projectId) || projects[0];
    const projectSettings = workspaces[workspaceId]?.[project.id] || defaultColumnValues;
    changeColumn(workspaceId, project.id, { createTaskForm: !projectSettings.createTaskForm });
  };

  // Open on key press
  const hotKeyPress = (field: string) => {
    if (!currentTask) return;

    const taskCard = document.getElementById(taskIdPreview ? `sheet-card-${currentTask.id}` : currentTask.id);
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
  const hotkeysToUse = mode === 'board' ? [...boardHotKeys, ...defaultHotKeys] : defaultHotKeys;
  useHotkeys(hotkeysToUse);

  return null; // No UI, this component only handles hotkeys
}
