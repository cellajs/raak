import type { Project } from 'sdk';
import { DeleteForm } from '~/modules/common/delete-form';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useProjectDeleteMutation } from '~/modules/project/query';

interface Props {
  projects: Project[];
  dialog?: boolean;
  callback?: (project: Project[]) => void;
  onCancel?: () => void;
}

function DeleteProjects({ projects, callback, dialog: isDialog, onCancel }: Props) {
  const removeDialog = () => useDialoger.getState().remove();
  const organizationId = projects[0].organizationId;
  const tenantId = projects[0].tenantId;

  const { mutate: deleteProjects, isPending } = useProjectDeleteMutation();

  const onDelete = () => {
    deleteProjects(
      { path: { organizationId, tenantId }, body: { ids: projects.map(({ id }) => id) }, projects },
      {
        onSuccess: () => {
          if (isDialog) removeDialog();
          callback?.(projects);
        },
      },
    );
  };

  return <DeleteForm onDelete={onDelete} onCancel={onCancel ?? removeDialog} pending={isPending} />;
}

export { DeleteProjects };
