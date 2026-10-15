import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { DeleteForm } from '~/modules/common/delete-form';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { toaster } from '~/modules/common/toaster/toaster';
import { useProjectDeleteMutation } from '~/modules/project/query';

interface Props {
  projects: Project[];
  dialog?: boolean;
  callback?: (project: Project[]) => void;
  onCancel?: () => void;
}

function DeleteProjects({ projects, callback, dialog: isDialog, onCancel }: Props) {
  const { t } = useTranslation();
  const removeDialog = () => useDialoger.getState().remove();
  const organizationId = projects[0].organizationId;
  const tenantId = projects[0].tenantId;

  const { mutate: deleteProjects, isPending } = useProjectDeleteMutation();

  const onDelete = () => {
    deleteProjects(
      { path: { organizationId, tenantId }, body: { ids: projects.map(({ id }) => id) }, projects },
      {
        onSuccess: () => {
          toaster.success(
            projects.length === 1
              ? t('c:success.delete_resource', { resource: t('c:project') })
              : t('c:success.delete_counted_resources', { count: projects.length, resources: t('c:project_other').toLowerCase() }),
          );
          if (isDialog) removeDialog();
          callback?.(projects);
        },
      },
    );
  };

  return <DeleteForm onDelete={onDelete} onCancel={onCancel ?? removeDialog} pending={isPending} />;
}

export { DeleteProjects };
