import type { Project } from 'sdk';
import { DeleteItems, type DeleteItemsProps } from '~/modules/common/delete-items';
import { useProjectDeleteMutation } from '~/modules/project/query';

interface DeleteProjectsProps extends Pick<DeleteItemsProps<Project, unknown>, 'callback'> {
  projects: Project[];
}

export function DeleteProjects({ projects, ...props }: DeleteProjectsProps) {
  const mutation = useProjectDeleteMutation();
  const toVariables = (items: Project[]) => ({
    path: { organizationId: items[0].organizationId, tenantId: items[0].tenantId },
    body: { ids: items.map(({ id }) => id) },
    projects: items,
  });

  return <DeleteItems items={projects} mutation={mutation} toVariables={toVariables} resource="c:project" {...props} />;
}
