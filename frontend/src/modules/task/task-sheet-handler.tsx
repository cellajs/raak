import { useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useUrlSheet } from '~/modules/common/sheeter/use-url-sheet';
import { useTaskCardStore } from '~/modules/task/card/task-card-store';
import { TaskSheet } from '~/modules/task/card/task-sheet';
import { cachedTasks } from '~/modules/task/helpers/active-task';
import { setTaskCardFocus } from '~/modules/task/helpers/focus-task';
import { triggerTaskGlow } from '~/modules/task/helpers/task-glow';
import { useIsProjectReadOnly } from '~/modules/task/hooks/use-read-only';
import { taskKeys } from '~/modules/task/query';
import { Badge } from '~/modules/ui/badge';
import { queryClient } from '~/query/query-client';

const TaskSheetTitle = ({ taskId }: { taskId: string }) => {
  const { t } = useTranslation();
  const projectId = cachedTasks().find((task) => task.id === taskId)?.projectId;
  const isReadOnly = useIsProjectReadOnly(projectId);

  return (
    <span className="flex items-center gap-2">
      {t('c:task')}
      {isReadOnly && (
        <Badge variant="plain" className="font-normal text-xs opacity-75">
          {t('c:read_only')}
        </Badge>
      )}
    </span>
  );
};

/**
 * Handles opening/closing the task sheet based on URL search params.
 * Listens to `taskSheetId` in search params and manages the sheet lifecycle.
 */
function TaskSheetHandler() {
  const { t } = useTranslation();
  const search = useSearch({ strict: false }) as Record<string, string | undefined>;
  const taskSheetId = search.taskSheetId;

  // Suppress any board editor and mark board card to suppress glow while sheet is open.
  // Don't set the sheet task to 'editing' in the store — the sheet manages its own state
  // locally to avoid the board card also rendering a TaskUpdateForm.
  useEffect(() => {
    if (!taskSheetId) return;
    // Demote any other editing task (single-editor rule)
    const { states } = useTaskCardStore.getState();
    for (const [id, state] of Object.entries(states)) {
      if (state === 'editing') {
        useTaskCardStore.getState().suppressEdit(id);
      }
    }
    const boardCard = document.getElementById(taskSheetId);
    if (boardCard) boardCard.setAttribute('data-suppress-glow', '');
    return () => boardCard?.removeAttribute('data-suppress-glow');
  }, [taskSheetId]);

  useUrlSheet({
    searchParamKey: 'taskSheetId',
    renderContent: (id, organizationId) => <TaskSheet id={id} organizationId={organizationId} />,
    onAfterClose: (id) => {
      // Check for mutations that happened while the sheet was open
      const allTasksMutations = queryClient.getMutationCache().findAll({
        mutationKey: taskKeys.update,
        status: 'success',
        predicate: ({ state: { variables } }) => (variables as { id: string }).id === id,
      });

      // Add glow effect on updated task
      if (allTasksMutations.length) triggerTaskGlow(id);

      // Restore focus to task card
      setTaskCardFocus(id);
    },
    options: {
      side: 'right',
      className: 'max-w-full lg:max-w-4xl p-0 scrollable',
      title: t('c:task'),
      titleContent: taskSheetId ? <TaskSheetTitle taskId={taskSheetId} /> : t('c:task'),
      closeSheetOnEsc: false,
      headerClassName: 'static',
    },
  });

  return null;
}

export { TaskSheetHandler };
