import { PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDraftStore } from '~/modules/common/form-draft/draft-store';
import type { EnrichedProject } from '~/modules/project/types';
import { useIsProjectReadOnly } from '~/modules/project/use-read-only';
import { createTaskFormId, type NewTaskFormValues, newTaskFormIsDirty, toggleCreateTaskForm } from '~/modules/task/helpers/create-task';
import { useTaskInteractionStore } from '~/modules/task/task-interaction-store';
import { newTaskButtonClass } from '~/modules/task/task-styles';
import { Badge } from '~/modules/ui/badge';
import { Button, type ButtonProps } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

interface NewTaskButtonProps extends Pick<ButtonProps, 'size' | 'className'> {
  project: EnrichedProject;
}

/** Opens or closes a project's create-task form, and marks an unsent draft; a read-only project has none. */
export function NewTaskButton({ project, size = 'xs', className }: NewTaskButtonProps) {
  const { t } = useTranslation();

  const hasDraft = useDraftStore((state) => {
    const storedForm = state.getForm<NewTaskFormValues>(createTaskFormId(project.id));
    return !!storedForm && newTaskFormIsDirty(storedForm);
  });
  const isReadOnly = useIsProjectReadOnly(project.id);
  const isCreateFormOpen = useTaskInteractionStore((state) => state.draftTasks[project.id] !== undefined);

  if (isReadOnly) return null;

  return (
    <Button
      data-form-dirty={hasDraft}
      variant="secondary"
      size={size}
      className={cn(newTaskButtonClass, className)}
      onClick={() => toggleCreateTaskForm(project)}
    >
      <Badge className="absolute -top-1 -right-1 z-100 in-data-[form-dirty=false]:hidden size-2 p-0" />
      <PlusIcon className={cn('size-4.5 transition-transform duration-200', isCreateFormOpen && 'rotate-45')} />
      <span>{t('c:task')}</span>
    </Button>
  );
}
