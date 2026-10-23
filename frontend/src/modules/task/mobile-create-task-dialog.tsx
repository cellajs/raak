import i18n from 'i18next';
import { Suspense } from 'react';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { Spinner } from '~/modules/common/spinner';
import { lazyNamed } from '~/utils/lazy-named';

const CreateTaskForm = lazyNamed(() => import('~/modules/task/create-task-form'), 'CreateTaskForm');

interface MobileCreateTaskDialogProps {
  projectId: string;
  organizationId: string;
}

function MobileCreateTaskDialog({ projectId, organizationId }: MobileCreateTaskDialogProps) {
  return (
    <Suspense fallback={<Spinner size="lg" className="mt-[45vh]" noDelay />}>
      <CreateTaskForm projectId={projectId} organizationId={organizationId} dialog />
    </Suspense>
  );
}

export const openCreateTaskDialog = (projectId: string, organizationId: string) => {
  return dialoger.getState().create(<MobileCreateTaskDialog projectId={projectId} organizationId={organizationId} />, {
    id: 'create-task',
    drawerOnMobile: false,
    className: 'min-w-full h-screen max-sm:max-h-[100dvh] border-0 rounded-none flex flex-col mt-0 overflow-auto',
    triggerRef: { current: null },
    title: i18n.t('c:create_resource', { resource: i18n.t('c:task').toLowerCase() }),
  });
};
