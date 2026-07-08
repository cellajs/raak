import { useState } from 'react';
import { DeleteForm } from '~/modules/common/delete-form';
import { useTaskDeleteMutation } from '~/modules/task/query';
import type { Task } from '~/modules/task/types';

interface DeleteTaskProps {
  task: Task;
  callback?: () => void;
  onCancel?: () => void;
}

export function DeleteTask({ task, callback, onCancel }: DeleteTaskProps) {
  const deleteMutation = useTaskDeleteMutation(task.tenantId, task.organizationId);
  const [isPending, setIsPending] = useState(false);

  const onDelete = async () => {
    setIsPending(true);
    try {
      await deleteMutation.mutateAsync({ tasksToDelete: [task] });
      callback?.();
    } catch {
      // mutation error handling is done in the mutation itself
    } finally {
      setIsPending(false);
    }
  };

  return <DeleteForm onDelete={onDelete} onCancel={onCancel ?? (() => {})} pending={isPending} />;
}
