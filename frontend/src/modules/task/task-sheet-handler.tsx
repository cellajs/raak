import { useSearch } from '@tanstack/react-router';
import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useUrlSheet } from '~/modules/common/sheeter/use-url-sheet';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { taskCardStore } from '~/modules/task/card/task-card-store';
import { TaskSheet } from '~/modules/task/card/task-sheet';
import { cachedTasks, subscribeToTaskCache } from '~/modules/task/helpers/active-task';
import { focusItem } from '~/modules/task/helpers/focus-item';
import { suppressGlowAttr, triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { taskKeys } from '~/modules/task/query';
import { taskSheetParam } from '~/modules/task/search-params-schemas';
import { Badge } from '~/modules/ui/badge';
import { entityIdsOf } from '~/query/offline/mutation-variables';
import { queryClient } from '~/query/query-client';

interface TaskSheetTitleProps {
  taskId: string;
}

function TaskSheetTitle({ taskId }: TaskSheetTitleProps) {
  const { t } = useTranslation();
  const projectId = useSyncExternalStore(subscribeToTaskCache, () => cachedTasks().find((task) => task.id === taskId)?.projectId);
  const isReadOnly = useIsProjectReadOnly(projectId);

  return (
    <span className="flex items-center gap-2">
      {t('c:task')}
      {isReadOnly && (
        <Badge variant="plain" className="font-normal opacity-75">
          {t('c:read_only')}
        </Badge>
      )}
    </span>
  );
}

/** Opens and closes the task sheet from the `taskSheetId` search param. */
export function TaskSheetHandler() {
  const { t } = useTranslation();
  const taskSheetId = useSearch({ strict: false, select: (search) => search.taskSheetId });

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
    renderContent: (id, organizationId) => <TaskSheet id={id} organizationId={organizationId} />,
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
