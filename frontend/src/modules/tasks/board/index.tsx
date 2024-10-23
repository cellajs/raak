import { useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBreakpoints } from '~/hooks/use-breakpoints';
import { useEventListener } from '~/hooks/use-event-listener';
import { dispatchCustomEvent } from '~/lib/custom-events';
import { WorkspaceBoardRoute } from '~/routes/workspaces';
import { useWorkspaceStore } from '~/store/workspace';

import BoardDesktop from '~/modules/tasks/board/board-desktop';
import { BoardEmpty } from '~/modules/tasks/board/board-empty';
import type { TaskCardToggleSelectEvent, TaskStates, TaskStatesChangeEvent } from '~/modules/tasks/types';
import { useWorkspaceQuery } from '~/modules/workspaces/helpers/use-workspace';
import { BoardMobile } from './board-mobile';

export default function Board() {
  const isMobile = useBreakpoints('max', 'sm');
  const { q } = useSearch({ from: WorkspaceBoardRoute.id });
  const { focusedTaskId, selectedTasks, setSearchQuery, setSelectedTasks } = useWorkspaceStore();

  const {
    data: { workspace, projects: queryProjects },
  } = useWorkspaceQuery();

  const prevFocusedRef = useRef<string | null>(focusedTaskId);
  const [tasksState, setTasksState] = useState<Record<string, TaskStates>>({});

  const setTaskState = (taskId: string, state: TaskStates) => {
    setTasksState((prevState) => ({
      ...prevState,
      [taskId]: state,
    }));
  };

  // TODO maybe find other way
  const projects = useMemo(
    () => queryProjects.filter((p) => !p.membership?.archived).sort((a, b) => (a.membership?.order ?? 0) - (b.membership?.order ?? 0)),
    [queryProjects],
  );

  const handleToggleTaskSelect = (event: TaskCardToggleSelectEvent) => {
    const { selected, taskId } = event.detail;
    if (selected) return setSelectedTasks([...selectedTasks, taskId]);
    return setSelectedTasks(selectedTasks.filter((id) => id !== taskId));
  };

  const handleTaskState = (event: TaskStatesChangeEvent) => {
    const { taskId, state, sheet } = event.detail;
    if (sheet) return;
    if (state === 'currentState') return setTaskState(taskId, tasksState[taskId] === 'folded' ? 'folded' : 'expanded');
    setTaskState(taskId, state);
  };

  useEventListener('changeTaskState', handleTaskState);
  useEventListener('toggleSelectTask', handleToggleTaskSelect);

  useEffect(() => {
    const { current: prevFocused } = prevFocusedRef;

    // Prevent state change if the focused task hasn't changed
    if (prevFocused === focusedTaskId) return;

    // Check if the previously focused task exists
    if (prevFocused) {
      const currentState = tasksState[prevFocused];
      const newState = currentState === 'folded' || !currentState ? 'folded' : 'expanded';

      setTimeout(() => setTaskState(prevFocused, newState), 0);
      // Fold the subtasks of the previously focused task
      dispatchCustomEvent('changeSubtaskState', { taskId: prevFocused, state: 'folded' });
    }

    // Update the previous focused task ID
    prevFocusedRef.current = focusedTaskId;
  }, [focusedTaskId, tasksState, setTaskState]);

  useEffect(() => {
    if (q?.length) setSearchQuery(q);
  }, []);

  if (!projects.length) return <BoardEmpty />;

  return (
    <>
      {isMobile ? (
        <BoardMobile tasksState={tasksState} projects={projects} workspaceId={workspace.id} />
      ) : (
        <BoardDesktop tasksState={tasksState} projects={projects} workspaceId={workspace.id} />
      )}
    </>
  );
}
