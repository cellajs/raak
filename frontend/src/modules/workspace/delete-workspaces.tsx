import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { DeleteForm } from '~/modules/common/delete-form';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { toaster } from '~/modules/common/toaster/toaster';
import { useWorkspaceDeleteMutation } from '~/modules/workspace/query';

interface Props {
  workspaces: Workspace[];
  dialog?: boolean;
  callback?: (workspace: Workspace[]) => void;
}

function DeleteWorkspaces({ workspaces, callback, dialog: isDialog }: Props) {
  const { t } = useTranslation();
  const removeDialog = () => useDialoger.getState().remove();

  const { mutate: deleteWorkspaces, isPending } = useWorkspaceDeleteMutation();

  const onDelete = () =>
    deleteWorkspaces(
      {
        path: { organizationId: workspaces[0].organizationId, tenantId: workspaces[0].tenantId },
        body: { ids: workspaces.map(({ id }) => id) },
        workspaces,
      },
      {
        onSuccess: () => {
          toaster.success(
            workspaces.length > 1
              ? t('c:success.delete_counted_resources', { count: workspaces.length, resources: t('c:workspace_other').toLowerCase() })
              : t('c:success.delete_resource', { resource: t('c:workspace') }),
          );
          if (isDialog) removeDialog();
          callback?.(workspaces);
        },
      },
    );

  return <DeleteForm onDelete={onDelete} onCancel={removeDialog} pending={isPending} />;
}

export { DeleteWorkspaces };
