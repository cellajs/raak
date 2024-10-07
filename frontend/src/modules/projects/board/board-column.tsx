import { useShape } from '@electric-sql/react';
import { queryOptions, useMutationState } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronDown, Palmtree, Plus, Search, Undo } from 'lucide-react';
import { type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type GetTasksParams, getTasksList } from '~/api/tasks';
import { useEventListener } from '~/hooks/use-event-listener';

import { type Edge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { toast } from 'sonner';
import { updateTask } from '~/api/tasks';
import { useMutateTasksQueryData } from '~/hooks/use-mutate-query-data';
import ContentPlaceholder from '~/modules/common/content-placeholder';
import { type DialogT, dialog } from '~/modules/common/dialoger/state';
import FocusTrap from '~/modules/common/focus-trap';
import { sheet } from '~/modules/common/sheeter/state';
import { BoardColumnHeader } from '~/modules/projects/board/board-column-header';
import { ColumnSkeleton } from '~/modules/projects/board/column-skeleton';
import { isSubTaskData, isTaskData } from '~/modules/projects/board/helpers';
import CreateTaskForm from '~/modules/tasks/create-task-form';
import { getRelativeTaskOrder, sortAndGetCounts } from '~/modules/tasks/helpers';
import { TaskCard } from '~/modules/tasks/task';
import type { CustomEventDetailId, TaskChangeEvent, TaskStates } from '~/modules/tasks/types';
import { Button } from '~/modules/ui/button';
import { ScrollArea, ScrollBar } from '~/modules/ui/scroll-area';
import { taskKeys } from '~/query-client-provider';
import { useNavigationStore } from '~/store/navigation';
import { useThemeStore } from '~/store/theme';
import { useWorkspaceStore } from '~/store/workspace';
import { useWorkspaceUIStore } from '~/store/workspace-ui';
import type { Label, Project, Task } from '~/types/app';
import type { Member } from '~/types/common';
import { cn } from '~/utils/cn';

interface BoardColumnProps {
  tasksState: Record<string, TaskStates>;
  project: Project;
}

export const tasksQueryOptions = ({ projectId, orgIdOrSlug }: GetTasksParams) => {
  return queryOptions({
    queryKey: taskKeys.list({ projectId, orgIdOrSlug }),
    queryFn: async () =>
      await getTasksList({
        orgIdOrSlug,
        projectId,
      }),
  });
};

const taskVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: { opacity: 1, height: 'auto' },
  exit: { opacity: 0, height: 0 },
};

const baseUrl = import.meta.env.ELECTRIC_URL ?? 'http://localhost:3000';

type UseShapeOptions = Parameters<typeof useShape<RawTask>>[0];
export const taskShape = (projectId?: string): UseShapeOptions => ({
  url: new URL('/v1/shape/tasks', baseUrl).href,
  where: projectId ? `project_id = '${projectId}'` : undefined,
});

type RawTask = {
  id: string;
  description: string;
  keywords: string;
  expandable: boolean;
  entity: 'task';
  summary: string;
  type: 'bug' | 'feature' | 'chore';
  impact: number;
  sort_order: number;
  status: number;
  parent_id: string;
  labels: string[];
  assigned_to: string[];
  organization_id: string;
  project_id: string;
  created_at: string;
  created_by: string;
  modified_at: string;
  modified_by: string;
};

export function BoardColumn({ project, tasksState }: BoardColumnProps) {
  const { t } = useTranslation();
  const defaultTaskFormRef = useRef<HTMLDivElement | null>(null);
  const afterRef = useRef<HTMLDivElement | null>(null);
  const beforeRef = useRef<HTMLDivElement | null>(null);
  const columnRef = useRef<HTMLDivElement | null>(null);
  const cardListRef = useRef<HTMLDivElement | null>(null);

  const { menu } = useNavigationStore();
  const { mode } = useThemeStore();
  const { workspace, searchQuery, selectedTasks, projects, focusedTaskId, setFocusedTaskId, members, labels } = useWorkspaceStore();
  const { workspaces, changeColumn } = useWorkspaceUIStore();

  const currentProjectSettings = workspaces[workspace.id]?.[project.id];
  const [showIced, setShowIced] = useState(currentProjectSettings?.expandIced || false);
  const [showAccepted, setShowAccepted] = useState(currentProjectSettings?.expandAccepted || false);
  const [mouseX, setMouseX] = useState(0);
  const [isMouseNearTop, setIsMouseNearTop] = useState(false);
  const [isMouseNearBottom, setIsMouseNearBottom] = useState(false);

  // Query tasks
  // const { data, isLoading } = useSuspenseQuery(tasksQueryOptions({ projectId: project.id, orgIdOrSlug: project.organizationId }));

  const { data: items, isLoading } = useShape<RawTask>(taskShape(project.id));
  const submissions: Task[] = useMutationState({
    filters: { status: 'pending' },
    select: (mutation) => mutation.state.context as Task,
  }).filter((item) => item !== undefined);

  const tasks = useMemo(() => {
    // map raw tasks to tasks
    const respTasks = items.reduce((acc, item) => {
      const createdBy = members.find((m) => m.id === item.created_by) ?? null;
      const assignedTo = item.assigned_to.map((id) => members.find((m) => m.id === id)).filter(Boolean) as Member[];
      const modifiedBy = members.find((m) => m.id === item.modified_by) ?? null;
      const taskLabels = item.labels.map((id) => labels.find((l) => l.id === id)).filter(Boolean) as Label[];
      const task: Task = {
        ...item,
        createdAt: item.created_at,
        createdBy,
        assignedTo,
        modifiedAt: item.modified_at,
        modifiedBy,
        order: item.sort_order,
        organizationId: item.organization_id,
        parentId: item.parent_id,
        projectId: item.project_id,
        labels: taskLabels,
        subTasks: [],
      };
      if (item.parent_id) {
        const parentTask = acc.find((t) => t.id === item.parent_id);
        if (parentTask) {
          parentTask.subTasks.push(task);
        }
        return acc;
      }

      acc.push(task);
      return acc;
    }, [] as Task[]);
    if (!searchQuery.length) return respTasks;
    return respTasks.filter((t) => t.keywords.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [items, searchQuery]);

  const itemsMap = new Map<string, Task>();
  for (const item of tasks.concat(submissions)) {
    itemsMap.set(item.id, { ...itemsMap.get(item.id), ...item });
  }

  const {
    sortedTasks: showingTasks,
    acceptedCount,
    icedCount,
  } = useMemo(() => sortAndGetCounts([...itemsMap.values()], showAccepted, showIced), [itemsMap, showAccepted, showIced]);

  const firstUpstartedIndex = useMemo(() => showingTasks.findIndex((t) => t.status === 1), [showingTasks]);
  const lastUpstartedIndex = useMemo(() => showingTasks.findLastIndex((t) => t.status === 1), [showingTasks]);

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    if (index !== firstUpstartedIndex && index !== lastUpstartedIndex) return;
    const isOpenDialog = dialog.get(`create-task-form-${project.id}`);
    if (isOpenDialog && (isOpenDialog as DialogT)?.open) return;
    const target = e.currentTarget as HTMLElement;
    const { top, left } = target.getBoundingClientRect();
    const mouseY = e.clientY - top;
    const mouseX = e.clientX - left;
    // to match half button width
    setMouseX(mouseX - 30);
    // mouse in the edge of 5% of the task card
    const isNearTop = mouseY < target.offsetHeight * 0.05;
    const isNearBottom = mouseY > target.offsetHeight * 0.95;
    if (index === firstUpstartedIndex) setIsMouseNearTop(isNearTop);
    if (index === lastUpstartedIndex) setIsMouseNearBottom(isNearBottom);
  };

  const handleIcedClick = () => {
    setShowIced(!showIced);
    changeColumn(workspace.id, project.id, {
      expandIced: !showIced,
    });
  };
  const handleAcceptedClick = () => {
    setShowAccepted(!showAccepted);
    changeColumn(workspace.id, project.id, {
      expandAccepted: !showAccepted,
    });
  };

  const openCreateTaskDialog = (ref: MutableRefObject<HTMLDivElement | null>) => {
    dialog(<CreateTaskForm projectIdOrSlug={project.id} tasks={showingTasks} dialog />, {
      id: `create-task-form-${project.id}`,
      drawerOnMobile: false,
      className: 'w-auto shadow-none relative z-[50] p-0 rounded-none border-y-0 mt-0 max-w-4xl',
      container: ref.current,
      containerBackdrop: false,
    });
  };

  const handleTaskChangeEventListener = (event: TaskChangeEvent) => {
    const { taskId, direction, projectId } = event.detail;
    if (projectId !== project.id) return;
    const currentFocusedIndex = showingTasks.findIndex((t) => t.id === taskId);
    if (!showingTasks[currentFocusedIndex + direction]) return;
    const { id } = showingTasks[currentFocusedIndex + direction];
    const taskCard = document.getElementById(id);
    if (taskCard && document.activeElement !== taskCard) taskCard.focus();

    setFocusedTaskId(id);
  };

  const handleProjectChangeEventListener = (event: CustomEventDetailId) => {
    if (event.detail !== project.id) return;
    const { id } = showingTasks[0];
    const taskCard = document.getElementById(id);
    if (taskCard && document.activeElement !== taskCard) taskCard.focus();
    setFocusedTaskId(id);
  };

  const handleTaskFormClick = (e: { detail: string | null }) => {
    const { detail: idOrSlug } = e;
    if (idOrSlug && project.id !== idOrSlug && project.slug !== idOrSlug) return;
    if (!idOrSlug && projects[0].id !== project.id) return;
    openCreateTaskDialog(defaultTaskFormRef);
  };

  useEventListener('toggleCreateTaskForm', handleTaskFormClick);
  useEventListener('focusedTaskChange', handleTaskChangeEventListener);
  useEventListener('focusedProjectChange', handleProjectChangeEventListener);

  // Hides underscroll elements
  // 4rem refers to the header height
  const stickyBackground = <div className="sm:hidden left-0 right-0 h-4 bg-background sticky top-0 z-30 -mt-4" />;

  useEffect(() => {
    return combine(
      monitorForElements({
        canMonitor({ source }) {
          return (isTaskData(source.data) || isSubTaskData(source.data)) && !sheet.getAll().length;
        },
        async onDrop({ location, source }) {
          const target = location.current.dropTargets[0];
          if (!target) return;

          const sourceData = source.data;
          const targetData = target.data;
          const isTask = isTaskData(sourceData) && isTaskData(targetData);
          const isSubTask = isSubTaskData(sourceData) && isSubTaskData(targetData);
          if (!isTask && !isSubTask) return;

          const { item: sourceItem } = sourceData;
          const { item: targetItem } = targetData;
          if (sourceItem.projectId !== project.id) return;

          const edge: Edge | null = extractClosestEdge(targetData);
          if (!edge) return;

          const mainCallback = useMutateTasksQueryData(['boardTasks', project.id]);
          if (isTask) {
            const newOrder: number = getRelativeTaskOrder(edge, showingTasks, targetData.order, sourceItem.id, undefined, sourceItem.status);
            try {
              if (project.id !== targetItem.projectId) {
                const updatedTask = await updateTask({
                  id: sourceItem.id,
                  orgIdOrSlug: workspace.organizationId,
                  key: 'projectId',
                  data: targetItem.projectId,
                  order: newOrder,
                });
                const targetProjectCallback = useMutateTasksQueryData(['boardTasks', targetItem.projectId]);
                mainCallback([updatedTask], 'delete');
                targetProjectCallback([updatedTask], 'create');
              } else {
                const updatedTask = await updateTask({
                  id: sourceItem.id,
                  orgIdOrSlug: workspace.organizationId,
                  key: 'order',
                  data: newOrder,
                });
                mainCallback([updatedTask], 'update');
              }
            } catch (err) {
              toast.error(t('common:error.reorder_resource', { resource: t('app:todo') }));
            }
          }

          if (isSubTask) {
            const newOrder = getRelativeTaskOrder(edge, showingTasks, targetData.order, sourceItem.id, targetItem.parentId ?? undefined);
            try {
              const updatedTask = await updateTask({
                id: sourceItem.id,
                orgIdOrSlug: workspace.organizationId,
                key: 'order',
                data: newOrder,
              });
              mainCallback([updatedTask], 'updateSubTask');
            } catch (err) {
              toast.error(t('common:error.reorder_resource', { resource: t('app:todo') }));
            }
          }
        },
      }),
    );
  }, [menu, items]);

  return (
    <div ref={columnRef} className="flex flex-col h-full">
      <BoardColumnHeader project={project} />
      <div
        className={cn(
          'flex-1 sm:h-[calc(100vh-146px)] relative rounded-b-none max-w-full bg-transparent group/column flex flex-col flex-shrink-0 snap-center border-b opacity-100',
          selectedTasks.length && 'is-selected',
        )}
      >
        {stickyBackground}

        <div className="h-full border-l border-r">
          {isLoading ? (
            <ColumnSkeleton />
          ) : (
            <ScrollArea id={project.id} className="h-full mx-[-.07rem]">
              <ScrollBar />
              <div className="z-[250]" ref={defaultTaskFormRef} />

              <div className="h-full flex flex-col" id={`tasks-list-${project.id}`} ref={cardListRef}>
                {!!tasks.length && (
                  <div className="flex flex-col flex-grow">
                    <Button
                      onClick={handleAcceptedClick}
                      variant="ghost"
                      disabled={!acceptedCount}
                      size="sm"
                      className="flex relative justify-start w-full rounded-none gap-1 border-b border-b-green-500/10 ring-inset bg-green-500/5 hover:bg-green-500/10 text-green-500 text-xs -mt-[.07rem]"
                    >
                      <span className="w-6 mr-1.5 text-center">{acceptedCount}</span>
                      <span>{t('app:accepted').toLowerCase()}</span>
                      {!!acceptedCount && (
                        <ChevronDown
                          size={16}
                          className={`transition-transform absolute right-5 opacity-50 ${showAccepted ? 'rotate-180' : 'rotate-0'}`}
                        />
                      )}
                    </Button>
                    {showingTasks.map((task, index) => {
                      return (
                        <div key={task.id}>
                          {index === firstUpstartedIndex && <div className="z-[250]" ref={beforeRef} />}
                          <motion.div
                            variants={taskVariants}
                            initial={task.status === 6 || task.status === 0 ? 'hidden' : 'visible'}
                            animate="visible"
                            exit="exit"
                            className={cn((index === firstUpstartedIndex || index === lastUpstartedIndex) && 'group relative')}
                            onMouseMove={(e) => handleMouseMove(e, index)} // track mouse movement
                            onMouseLeave={() => {
                              setIsMouseNearTop(false);
                              setIsMouseNearBottom(false);
                            }}
                          >
                            <FocusTrap mainElementId={task.id} active={task.id === focusedTaskId}>
                              <TaskCard
                                task={task}
                                state={tasksState[task.id] ?? 'folded'}
                                isSelected={selectedTasks.includes(task.id)}
                                isFocused={task.id === focusedTaskId}
                                mode={mode}
                              />
                              {/* Conditionally render "+ Task" button for first and last task */}
                              {((index === firstUpstartedIndex && isMouseNearTop) || (index === lastUpstartedIndex && isMouseNearBottom)) && (
                                <Button
                                  variant="plain"
                                  size="xs"
                                  style={{ left: `${mouseX}px` }}
                                  className={`absolute bg-background hover:bg-background transform -translate-y-1/2 opacity-1 rounded hidden sm:inline-flex ${index === firstUpstartedIndex ? 'top' : 'bottom'}-2`}
                                  onClick={() => openCreateTaskDialog(index === firstUpstartedIndex ? beforeRef : afterRef)}
                                >
                                  <Plus size={16} />
                                  <span className="ml-1">{t('app:task')}</span>
                                </Button>
                              )}
                            </FocusTrap>
                          </motion.div>
                          {index === lastUpstartedIndex && <div className="z-[250]" ref={afterRef} />}
                        </div>
                      );
                    })}
                    <Button
                      onClick={handleIcedClick}
                      variant="ghost"
                      disabled={!icedCount}
                      size="sm"
                      className="flex relative justify-start w-full rounded-none gap-1 ring-inset text-sky-500 bg-sky-500/5 hover:bg-sky-500/10 text-xs -mt-[.07rem]"
                    >
                      <span className="w-6 mr-1.5 text-center">{icedCount}</span>
                      <span> {t('app:iced').toLowerCase()}</span>
                      {!!icedCount && (
                        <ChevronDown
                          size={16}
                          className={`transition-transform absolute right-5 opacity-50 ${showIced ? 'rotate-180' : 'rotate-0'}`}
                        />
                      )}
                    </Button>
                  </div>
                )}

                {!tasks.length && !searchQuery && (
                  <ContentPlaceholder
                    Icon={Palmtree}
                    title={t('common:no_resource_yet', { resource: t('app:tasks').toLowerCase() })}
                    text={
                      <>
                        <Undo
                          size={200}
                          strokeWidth={0.2}
                          className="max-md:hidden absolute scale-x-0 scale-y-75 rotate-180 text-primary top-4 right-4 translate-y-20 opacity-0 duration-500 delay-500 transition-all group-hover/column:opacity-100 group-hover/column:scale-x-100 group-hover/column:translate-y-0 group-hover/column:rotate-[130deg]"
                        />
                        <p className="inline-flex gap-1 opacity-0 duration-500 transition-opacity group-hover/column:opacity-100">
                          <span>{t('common:click')}</span>
                          <span className="text-primary">{`+ ${t('app:task')}`}</span>
                          <span>{t('app:no_tasks.text')}</span>
                        </p>
                      </>
                    }
                  />
                )}
                {!tasks.length && searchQuery && (
                  <ContentPlaceholder Icon={Search} title={t('common:no_resource_found', { resource: t('app:tasks').toLowerCase() })} />
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
