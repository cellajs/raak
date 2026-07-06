import type { Workspace } from 'sdk';
import { DeleteForm } from '~/modules/common/delete-form';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useWorkspaceDeleteMutation } from '~/modules/workspace/query';

interface Props {
  workspaces: Workspace[];
  dialog?: boolean;
  callback?: (workspace: Workspace[]) => void;
}

const DeleteWorkspaces = ({ workspaces, callback, dialog: isDialog }: Props) => {
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
          if (isDialog) removeDialog();
          callback?.(workspaces);
        },
      },
    );

  return <DeleteForm onDelete={onDelete} onCancel={removeDialog} pending={isPending} />;
};

export { DeleteWorkspaces };
