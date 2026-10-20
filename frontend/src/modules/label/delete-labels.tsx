import { DeleteForm } from '~/modules/common/delete-form';
import { type Label, useLabelDeleteMutation } from '~/modules/label/query';

interface Props {
  labels: Label[];
  callback?: () => void;
  onCancel: () => void;
}

export function DeleteLabels({ labels, callback, onCancel }: Props) {
  // All labels belong to one organization, so the first one carries the ids.
  const { mutate: deleteLabels, isPending } = useLabelDeleteMutation(labels[0].tenantId, labels[0].organizationId);

  // The delete is optimistic and queues offline, so the form does not wait for the server.
  const onDelete = () => {
    deleteLabels(labels);
    callback?.();
  };

  return <DeleteForm allowOfflineDelete onDelete={onDelete} onCancel={onCancel} pending={isPending} />;
}
