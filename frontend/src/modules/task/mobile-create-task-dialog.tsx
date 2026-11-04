import i18n from 'i18next';
import { type RefObject, Suspense } from 'react';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { Spinner } from '~/modules/common/spinner';
import type { TaskStatus } from '~/modules/task/task-properties';
import { lazyNamed } from '~/utils/lazy-named';

const CreateTaskForm = lazyNamed(() => import('~/modules/task/create-task-form'), 'CreateTaskForm');

interface MobileCreateTaskDialogProps {
  projectId: string;
  organizationId: string;
  initialStatus?: TaskStatus;
}

function MobileCreateTaskDialog({ projectId, organizationId, initialStatus }: MobileCreateTaskDialogProps) {
  return (
    <Suspense fallback={<Spinner size="lg" className="mt-[45vh]" noDelay />}>
      <CreateTaskForm projectId={projectId} organizationId={organizationId} initialStatus={initialStatus} dialog />
    </Suspense>
  );
}

export const openCreateTaskDialog = (
  projectId: string,
  organizationId: string,
  initialStatus: TaskStatus | undefined,
  triggerRef: RefObject<HTMLButtonElement | null>,
) =>
  dialoger.getState().create(<MobileCreateTaskDialog projectId={projectId} organizationId={organizationId} initialStatus={initialStatus} />, {
    id: 'create-task',
    drawerOnMobile: false,
    triggerRef,
    title: i18n.t('c:new_resource', { resource: i18n.t('c:task') }),
  });
