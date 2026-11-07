import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { DeleteForm } from '~/modules/common/delete-form';
import { useOverlayClose } from '~/modules/common/overlay-close';
import { toaster } from '~/modules/common/toaster/toaster';
import { useSampleRemoveMutation } from '~/modules/sample/query';

/** Confirms removing the organization's sample: both its projects, their tasks and the sample team. */
export function RemoveSample({ project }: { project: Project }) {
  const { t } = useTranslation();
  const overlay = useOverlayClose();
  const { mutate, isPending } = useSampleRemoveMutation();

  const remove = () =>
    mutate(
      { path: { tenantId: project.tenantId, organizationId: project.organizationId } },
      {
        onSuccess: () => {
          toaster.success(t('c:success.sample_removed'));
          overlay?.close();
        },
      },
    );

  return <DeleteForm label="c:remove_sample" onDelete={remove} pending={isPending} />;
}
