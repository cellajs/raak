import { useSearch } from '@tanstack/react-router';
import { useContext, useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { useUrlSheet } from '~/modules/common/sheeter/use-url-sheet';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { PublicBadge } from '~/modules/project/public-badge';
import { projectQueryKeys } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { ReadOnlyScope } from '~/modules/project/use-read-only';
import { taskCardStore } from '~/modules/task/card/task-card-store';
import { TaskSheet } from '~/modules/task/card/task-sheet';
import { subscribeToTaskCache } from '~/modules/task/helpers/active-task';
import { focusItem } from '~/modules/task/helpers/focus-item';
import { productRef } from '~/modules/task/helpers/product-ref';
import { suppressGlowAttr, triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { taskKeys } from '~/modules/task/query';
import { taskSheetParam } from '~/modules/task/search-params-schemas';
import type { Task } from '~/modules/task/types';
import { Separator } from '~/modules/ui/separator';
import { findInCache } from '~/query/basic/find-in-list-cache';
import { entityIdsOf } from '~/query/offline/mutation-variables';
import { queryClient } from '~/query/query-client';

type SheetProject = Pick<EnrichedProject, 'id' | 'name' | 'thumbnailUrl' | 'public'>;

const subscribeToQueryCache = (onStoreChange: () => void) => queryClient.getQueryCache().subscribe(onStoreChange);

// A public view caches its project under the public key only
const findSheetProject = (projectId: string | undefined): SheetProject | undefined => {
  if (!projectId) return;
  return findInCache<EnrichedProject>('project', projectId) ?? queryClient.getQueryData<SheetProject>(projectQueryKeys.detail.public(projectId));
};

// The board's lists may not hold it: a phone board loads one project, a link opens any task
const findSheetTask = (taskId: string) => findInCache<Task>('task', taskId) ?? queryClient.getQueryData<Task>(taskKeys.detail.public(taskId));

interface TaskSheetTitleProps {
  taskId: string;
}

function TaskSheetTitle({ taskId }: TaskSheetTitleProps) {
  const { t } = useTranslation();
  const projectId = useSyncExternalStore(subscribeToTaskCache, () => findSheetTask(taskId)?.projectId);
  const number = useSyncExternalStore(subscribeToTaskCache, () => findSheetTask(taskId)?.number);
  const getProject = () => findSheetProject(projectId);
  const project = useSyncExternalStore(subscribeToQueryCache, getProject, getProject);

  return (
    <span className="flex items-center gap-3">
      {project && (
        <>
          {/* size-5 and the sm badge: the title clips at its 24px line, so the notch must hang no further */}
          <TooltipButton toolTipContent={project.name} side="bottom">
            <span className="relative flex shrink-0">
              <EntityAvatar id={project.id} type="project" name={project.name} url={project.thumbnailUrl} className="size-5" />
              {project.public && <PublicBadge size="sm" />}
            </span>
          </TooltipButton>
          <Separator orientation="vertical" className="data-vertical:h-4" />
        </>
      )}
      <span className="flex items-center gap-2">
        {t('c:task')}
        {!!number && <span className="text-muted-foreground font-normal">{productRef(number)}</span>}
      </span>
    </span>
  );
}

/** Opens and closes the task sheet from the `taskSheetId` search param. */
export function TaskSheetHandler() {
  const { t } = useTranslation();
  const taskSheetId = useSearch({ strict: false, select: (search) => search.taskSheetId });
  // The sheet renders outside this tree, so a public view's scope is carried into it
  const inReadOnlyScope = useContext(ReadOnlyScope);

  // The sheet edits locally, so the board card must not also render an update form, and its glow is suppressed while the sheet is open.
  useEffect(() => {
    if (!taskSheetId) return;
    taskCardStore.getState().suppressAllEditing();
    const boardCard = document.getElementById(taskSheetId);
    if (boardCard) boardCard.setAttribute(suppressGlowAttr, '');
    return () => boardCard?.removeAttribute(suppressGlowAttr);
  }, [taskSheetId]);

  useUrlSheet({
    searchParamKey: taskSheetParam,
    renderContent: (id, organizationId) => (
      <ReadOnlyScope.Provider value={inReadOnlyScope}>
        <TaskSheet id={id} organizationId={organizationId} />
      </ReadOnlyScope.Provider>
    ),
    onAfterClose: (id) => {
      const updateMutations = queryClient.getMutationCache().findAll({
        mutationKey: taskKeys.update,
        status: 'success',
        predicate: ({ state: { variables } }) => entityIdsOf(variables).includes(id),
      });

      if (updateMutations.length) triggerTaskGlow(id);

      focusItem(id);
    },
    options: {
      side: 'right',
      className: 'p-0',
      title: t('c:task'),
      titleContent: taskSheetId ? <TaskSheetTitle taskId={taskSheetId} /> : t('c:task'),
      closeSheetOnEsc: false,
      headerClassName: 'static',
    },
  });

  return null;
}
