import { lazy, Suspense } from 'react';
import { Spinner } from '~/modules/common/spinner';

const CreateTaskForm = lazy(() => import('~/modules/task/create-task-form'));

interface MobileCreateTaskDialogProps {
  projectId: string;
  organizationId: string;
}

export const MobileCreateTaskDialog = ({ projectId, organizationId }: MobileCreateTaskDialogProps) => {
  return (
    <Suspense fallback={<Spinner className="mt-[45vh] h-10 w-10" noDelay />}>
      <CreateTaskForm projectId={projectId} organizationId={organizationId} dialog />
    </Suspense>
  );
};
