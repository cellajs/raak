import { type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { toast } from 'sonner';
import { useBreakpoints } from '~/hooks/use-breakpoints';
import { useEventListener } from '~/hooks/use-event-listener';
import { useTaskUpdateMutation } from '~/modules/common/query-client-provider/tasks';
import { isSubtaskData } from '~/modules/tasks/board/helpers';
import { getRelativeTaskOrder, setTaskCardFocus } from '~/modules/tasks/helpers';
import TaskCard from '~/modules/tasks/task';
import { useWorkspaceQuery } from '~/modules/workspaces/helpers/use-workspace';
import { useThemeStore } from '~/store/theme';
import type { Task } from '~/types/app';

import TasksHotkeysManager from '~/modules/tasks/tasks-hotkeys';
import type { TaskStates, TaskStatesChangeEvent } from './types';

interface TasksSheetProps {
  task: Task;
}

const TaskSheet = ({ task }: TasksSheetProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mode } = useThemeStore();
  const isMobile = useBreakpoints('max', 'sm');

  const taskMutation = useTaskUpdateMutation();

  const {
    data: { workspace },
  } = useWorkspaceQuery();

  const [state, setState] = useState<TaskStates>(isMobile ? 'expanded' : 'editing');

  const handleTaskState = (event: TaskStatesChangeEvent) => {
    const { taskId, state, sheet } = event.detail;

    if (!sheet || taskId !== task.id) return;
    if (state === 'currentState') return setState('expanded');
    setState(state);
  };

  useEventListener('changeTaskState', handleTaskState);

  useEffect(() => {
    setTaskCardFocus(`sheet-card-${task.id}`);
    // Add search parameter on mount
    navigate({
      to: '.',
      replace: true,
      resetScroll: false,
      search: (prev) => ({
        ...prev,
        taskIdPreview: task.id,
      }),
    });

    // Cleanup function to remove search parameter on unmount
    return () => {
      navigate({
        to: '.',
        replace: true,
        resetScroll: false,
        search: (prev) => {
          const { taskIdPreview, ...rest } = prev;
          return rest;
        },
      });
    };
  }, []);

  useEffect(() => {
    return combine(
      monitorForElements({
        canMonitor({ source }) {
          return isSubtaskData(source.data);
        },
        async onDrop({ location, source }) {
          const target = location.current.dropTargets[0];
          if (!target) return;
          const sourceData = source.data;
          const targetData = target.data;

          const edge: Edge | null = extractClosestEdge(targetData);
          const isSubtask = isSubtaskData(sourceData) && isSubtaskData(targetData);
          if (!edge || !isSubtask) return;
          const newOrder: number = getRelativeTaskOrder(edge, [], targetData.order, sourceData.item.id);
          try {
            await taskMutation.mutateAsync({
              id: sourceData.item.id,
              orgIdOrSlug: workspace.organizationId,
              key: 'order',
              data: newOrder,
              projectId: sourceData.item.projectId,
            });
          } catch (err) {
            toast.error(t('common:error.reorder_resource', { resource: t('app:todo') }));
          }
        },
      }),
    );
  }, [task]);

  return (
    <>
      <TasksHotkeysManager mode={'sheet'} />
      <TaskCard mode={mode} task={task} state={state} isSelected={false} isFocused={true} isSheet />
    </>
  );
};

export default TaskSheet;
