import { Suspense } from 'react';
import { Spinner } from '~/modules/common/spinner';
import { lazyNamed } from '~/utils/lazy-named';

const CreateTaskForm = lazyNamed(() => import('~/modules/task/create-task-form'), 'CreateTaskForm');

interface MobileCreateTaskDialogProps {
  projectId: string;
  organizationId: string;
}

export function MobileCreateTaskDialog({ projectId, organizationId }: MobileCreateTaskDialogProps) {
  return (
    <Suspense fallback={<Spinner size="lg" className="mt-[45vh]" noDelay />}>
      <CreateTaskForm projectId={projectId} organizationId={organizationId} dialog />
    </Suspense>
  );
}
