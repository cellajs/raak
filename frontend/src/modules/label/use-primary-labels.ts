import { useQuery } from '@tanstack/react-query';
import type { Label } from 'sdk';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { labelsCanonicalOptions } from '~/modules/label/query';

const primaryLabelsInOrder = (labels: Label[]): Label[] =>
  labels
    .filter((label) => label.mode === 'primary')
    .sort((a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER));

/** Primary labels of a project by displayOrder; the first is the default for new tasks. */
export const usePrimaryLabels = (projectId: string): Label[] => {
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const { data } = useQuery({
    ...labelsCanonicalOptions({ organizationId, tenantId, projectId }),
    select: (result) => primaryLabelsInOrder(result.items),
  });
  return data ?? [];
};
