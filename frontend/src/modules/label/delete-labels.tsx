import type { Label } from 'sdk';
import { DeleteItems, type DeleteItemsProps } from '~/modules/common/delete-items';
import { useLabelDeleteMutation } from '~/modules/label/query';

interface DeleteLabelsProps extends Pick<DeleteItemsProps<Label, Label[]>, 'dialog' | 'callback' | 'onCancel'> {
  labels: Label[];
}

export function DeleteLabels({ labels, ...props }: DeleteLabelsProps) {
  // All labels belong to one organization, so the first one carries the ids.
  const mutation = useLabelDeleteMutation(labels[0].tenantId, labels[0].organizationId);

  // The delete is optimistic and queues offline, so the form does not wait for the server.
  return <DeleteItems items={labels} mutation={mutation} toVariables={(items) => items} optimistic {...props} />;
}
