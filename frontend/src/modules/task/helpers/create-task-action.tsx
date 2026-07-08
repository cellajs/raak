import i18n from 'i18next';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { MobileCreateTaskDialog } from '~/modules/task/mobile-create-task-dialog';

/**
 * Opens the create task dialog used on mobile.
 */
export const createTaskAction = (projectId: string, organizationId: string) => {
  return useDialoger
    .getState()
    .create(<MobileCreateTaskDialog projectId={projectId} organizationId={organizationId} />, {
      id: 'create-task',
      drawerOnMobile: false,
      className: 'min-w-full h-screen max-sm:max-h-[100dvh] border-0 rounded-none flex flex-col mt-0 overflow-auto',
      triggerRef: { current: null },
      title: i18n.t('c:create_resource', { resource: i18n.t('c:task').toLowerCase() }),
    });
};
