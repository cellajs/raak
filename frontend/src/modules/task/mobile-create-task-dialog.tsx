import { Suspense } from 'react';
import { Spinner } from '~/modules/common/spinner';
import { lazyNamed } from '~/utils/lazy-named';

const CreateTaskForm = lazyNamed(() => import('~/modules/task/create-task-form'), 'CreateTaskForm');

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
