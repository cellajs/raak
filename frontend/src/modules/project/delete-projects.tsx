import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import type { CallbackArgs } from '~/modules/common/data-table/types';
import { DeleteItems, type DeleteItemsProps } from '~/modules/common/delete-items';
import { toaster } from '~/modules/common/toaster/toaster';
import { useProjectDeleteMutation } from '~/modules/project/query';

interface DeleteProjectsProps extends Pick<DeleteItemsProps<Project, unknown>, 'dialog' | 'callback'> {
  projects: Project[];
}

export function DeleteProjects({ projects, callback, ...props }: DeleteProjectsProps) {
  const { t } = useTranslation();
  const mutation = useProjectDeleteMutation();
  const toVariables = (items: Project[]) => ({
    path: { organizationId: items[0].organizationId, tenantId: items[0].tenantId },
    body: { ids: items.map(({ id }) => id) },
    projects: items,
  });

  const handleDeleted = (args: CallbackArgs<Project[]>) => {
    if (args.status === 'success') {
      toaster.success(
        args.data.length === 1
          ? t('c:success.delete_resource', { resource: t('c:project') })
          : t('c:success.delete_counted_resources', { count: args.data.length, resources: t('c:project_other').toLowerCase() }),
      );
    }
    callback?.(args);
  };

  return <DeleteItems items={projects} mutation={mutation} toVariables={toVariables} callback={handleDeleted} {...props} />;
}
