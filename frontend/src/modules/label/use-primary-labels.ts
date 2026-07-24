import { useQuery } from '@tanstack/react-query';
import type { Label } from 'sdk';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { labelsCanonicalOptions } from '~/modules/label/query';

/**
 * Live primary labels of a project from the canonical label list, sorted by displayOrder
 * (first entry is the default for new tasks).
 */
export const usePrimaryLabels = (projectId: string): Label[] => {
  const { tenantId, organization } = useOrganizationLayoutContext();
  const { data } = useQuery({
    ...labelsCanonicalOptions({ organizationId: organization.id, tenantId, projectId }),
    select: (result) => sortPrimaryLabels(result.items),
  });
  return data ?? [];
};

/** Filter a project's label list down to its live primary labels, ordered by displayOrder. */
export const sortPrimaryLabels = (labels: Label[]): Label[] =>
  labels
    .filter((label) => label.mode === 'primary')
    .toSorted((a, b) => (a.displayOrder ?? Number.MAX_SAFE_INTEGER) - (b.displayOrder ?? Number.MAX_SAFE_INTEGER));
