import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import type { CallbackArgs } from '~/modules/common/data-table/types';
import { DeleteItems, type DeleteItemsProps } from '~/modules/common/delete-items';
import { toaster } from '~/modules/common/toaster/toaster';
import { useWorkspaceDeleteMutation } from '~/modules/workspace/query';

interface DeleteWorkspacesProps extends Pick<DeleteItemsProps<Workspace, unknown>, 'dialog' | 'callback'> {
  workspaces: Workspace[];
}

export function DeleteWorkspaces({ workspaces, callback, ...props }: DeleteWorkspacesProps) {
  const { t } = useTranslation();
  const mutation = useWorkspaceDeleteMutation();
  const toVariables = (items: Workspace[]) => ({
    path: { organizationId: items[0].organizationId, tenantId: items[0].tenantId },
    body: { ids: items.map(({ id }) => id) },
    workspaces: items,
  });

  const handleDeleted = (args: CallbackArgs<Workspace[]>) => {
    if (args.status === 'success') {
      toaster.success(
        args.data.length > 1
          ? t('c:success.delete_counted_resources', { count: args.data.length, resources: t('c:workspace_other').toLowerCase() })
          : t('c:success.delete_resource', { resource: t('c:workspace') }),
      );
    }
    callback?.(args);
  };

  return <DeleteItems items={workspaces} mutation={mutation} toVariables={toVariables} callback={handleDeleted} {...props} />;
}
