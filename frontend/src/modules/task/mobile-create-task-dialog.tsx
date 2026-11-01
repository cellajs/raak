import i18n from 'i18next';
import { Suspense } from 'react';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { Spinner } from '~/modules/common/spinner';
import type { TaskStatus } from '~/modules/task/task-properties';
import { lazyNamed } from '~/utils/lazy-named';
import { tw } from '~/utils/tw';

const CreateTaskForm = lazyNamed(() => import('~/modules/task/create-task-form'), 'CreateTaskForm');

const createTaskDialogClassName = tw('mt-0 flex h-screen min-w-full flex-col overflow-auto rounded-none border-0 max-sm:max-h-[100dvh]');

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

export const openCreateTaskDialog = (projectId: string, organizationId: string, initialStatus?: TaskStatus) =>
  dialoger.getState().create(<MobileCreateTaskDialog projectId={projectId} organizationId={organizationId} initialStatus={initialStatus} />, {
    id: 'create-task',
    drawerOnMobile: false,
    className: createTaskDialogClassName,
    triggerRef: { current: null },
    title: i18n.t('c:new_resource', { resource: i18n.t('c:task') }),
  });
