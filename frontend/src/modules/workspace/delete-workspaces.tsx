import type { Workspace } from 'sdk';
import { DeleteItems, type DeleteItemsProps } from '~/modules/common/delete-items';
import { useWorkspaceDeleteMutation } from '~/modules/workspace/query';

interface DeleteWorkspacesProps extends Pick<DeleteItemsProps<Workspace, unknown>, 'callback'> {
  workspaces: Workspace[];
}

export function DeleteWorkspaces({ workspaces, ...props }: DeleteWorkspacesProps) {
  const mutation = useWorkspaceDeleteMutation();
  const toVariables = (items: Workspace[]) => ({
    path: { organizationId: items[0].organizationId, tenantId: items[0].tenantId },
    body: { ids: items.map(({ id }) => id) },
    workspaces: items,
  });

  return <DeleteItems items={workspaces} mutation={mutation} toVariables={toVariables} resource="c:workspace" {...props} />;
}
