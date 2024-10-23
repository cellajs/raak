import { useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useHotkeys } from '~/hooks/use-hot-keys';
import { dispatchCustomEvent } from '~/lib/custom-events';
import { queryClient } from '~/lib/router';
import { dropdowner } from '~/modules/common/dropdowner/state';
import { taskKeys } from '~/modules/common/query-client-provider/tasks';
import { handleTaskDropDownClick, setTaskCardFocus, sortAndGetCounts } from '~/modules/tasks/helpers';
import type { TaskStates } from '~/modules/tasks/types';
import { WorkspaceBoardRoute } from '~/routes/workspaces';
import { useWorkspaceStore } from '~/store/workspace';
import { defaultColumnValues, useWorkspaceUIStore } from '~/store/workspace-ui';
import type { Project, Task } from '~/types/app';

interface HotkeysManagerProps {
  workspaceId: string;
  projects: Project[];
  tasksState: Record<string, TaskStates>;
  setTaskState: (taskId: string, state: TaskStates) => void;
}

export default function BoardHotkeysManager({ workspaceId, projects, tasksState, setTaskState }: HotkeysManagerProps) {
  const { focusedTaskId: storeFocused } = useWorkspaceStore();
  const { taskIdPreview } = useSearch({ from: WorkspaceBoardRoute.id });
  const { workspaces, changeColumn } = useWorkspaceUIStore();

  // Retrieve all tasks
  const tasks = useMemo(() => {
    const queries = queryClient.getQueriesData({ queryKey: taskKeys.lists() });
    return queries.flatMap((el) => {
      const [, data] = el as [string[], undefined | { items: Task[] }];
      return data?.items ?? [];
    });
  }, [queryClient]);

  const currentTask = useMemo(() => tasks.find((t) => t.id === (taskIdPreview || storeFocused)), [taskIdPreview, storeFocused, tasks]);

  const handleVerticalArrowKeyDown = async (event: KeyboardEvent) => {
    if (!projects.length) return;
    if (currentTask && (tasksState[currentTask.id] === 'editing' || tasksState[currentTask.id] === 'unsaved')) return;

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

  const handleHorizontalArrowKeyDown = async (event: KeyboardEvent) => {
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

    const taskState = tasksState[currentTask.id];
    if (!taskState || taskState === 'folded') {
      // check if creation of task open
      const taskCreation = document.getElementById(`create-task-${currentTask.projectId}`);
      if (taskCreation) {
        changeColumn(workspaceId, currentTask.projectId, {
          createTaskForm: false,
        });
        return;
      }
    }
    if (taskState === 'editing' || taskState === 'unsaved') return setTaskState(currentTask.id, 'expanded');
    if (taskState === 'expanded') return setTaskState(currentTask.id, 'folded');
  };

  const handleEnterKeyPress = () => {
    if (!currentTask) return;
    const taskState = tasksState[currentTask.id];
    if (!taskState || taskState === 'folded') setTaskState(currentTask.id, 'expanded');
    if (taskState === 'expanded') setTaskState(currentTask.id, 'editing');
  };

  const handleNKeyDown = () => {
    if (!projects.length || !currentTask) return;

    const project = projects.find((p) => p.id === currentTask?.projectId) || projects[0];
    const projectSettings = workspaces[workspaceId]?.[project.id] || defaultColumnValues;
    changeColumn(workspaceId, project.id, { createTaskForm: !projectSettings.createTaskForm });
  };

  // Open on key press
  const hotKeyPress = (field: string) => {
    if (!currentTask || taskIdPreview) return;
    const taskCard = document.getElementById(currentTask.id);
    if (!taskCard) return;
    if (document.activeElement !== taskCard) taskCard.focus();

    const trigger = taskCard?.querySelector(`#${field}-${currentTask.id}`);
    if (!trigger) return dropdowner.remove();

    handleTaskDropDownClick(currentTask, field, trigger as HTMLElement);
  };

  // Register hotkeys using useHotkeys
  useHotkeys([
    ['ArrowRight', handleHorizontalArrowKeyDown],
    ['ArrowLeft', handleHorizontalArrowKeyDown],
    ['ArrowDown', handleVerticalArrowKeyDown],
    ['ArrowUp', handleVerticalArrowKeyDown],
    ['Escape', handleEscKeyPress],
    ['Enter', handleEnterKeyPress],
    ['N', handleNKeyDown],
    ['A', () => hotKeyPress('assignedTo')],
    ['I', () => hotKeyPress('impact')],
    ['L', () => hotKeyPress('labels')],
    ['S', () => hotKeyPress('status')],
    ['T', () => hotKeyPress('type')],
  ]);

  return null; // No UI, this component only handles hotkeys
}
