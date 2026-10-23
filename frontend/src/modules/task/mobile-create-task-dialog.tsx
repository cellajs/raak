import i18n from 'i18next';
import { Suspense } from 'react';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { Spinner } from '~/modules/common/spinner';
import { lazyNamed } from '~/utils/lazy-named';
import { tw } from '~/utils/tw';

const CreateTaskForm = lazyNamed(() => import('~/modules/task/create-task-form'), 'CreateTaskForm');

const createTaskDialogClassName = tw('mt-0 flex h-screen min-w-full flex-col overflow-auto rounded-none border-0 max-sm:max-h-[100dvh]');

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

export const openCreateTaskDialog = (projectId: string, organizationId: string) =>
  dialoger.getState().create(<MobileCreateTaskDialog projectId={projectId} organizationId={organizationId} />, {
    id: 'create-task',
    drawerOnMobile: false,
    className: createTaskDialogClassName,
    triggerRef: { current: null },
    title: i18n.t('c:create_resource', { resource: i18n.t('c:task').toLowerCase() }),
  });
