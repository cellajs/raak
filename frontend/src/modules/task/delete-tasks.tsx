import { useState } from 'react';
import { DeleteForm } from '~/modules/common/delete-form';
import { useTaskDeleteMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';

interface DeleteTasksProps {
  /** All of one organization, so the first task carries the ids. */
  tasks: Task[];
  callback?: () => void;
  onCancel?: () => void;
}

export function DeleteTasks({ tasks, callback, onCancel }: DeleteTasksProps) {
  const deleteMutation = useTaskDeleteMutation(tasks[0].tenantId, tasks[0].organizationId);
  const [isPending, setIsPending] = useState(false);

  const onDelete = async () => {
    setIsPending(true);
    try {
      await deleteMutation.mutateAsync(tasks);
      callback?.();
    } catch {
      // mutation error handling is done in the mutation itself
    } finally {
      setIsPending(false);
    }
  };

  return <DeleteForm onDelete={onDelete} onCancel={onCancel ?? (() => {})} pending={isPending} />;
}
