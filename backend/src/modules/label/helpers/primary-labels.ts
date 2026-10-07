import type { PrimaryLabelDefinition } from 'shared/config/labels-config';
import { defaultOrder, orderGap } from 'shared/utils/display-order';
import { createServerStx } from '#/core/stx/create-server-stx';
import type { InsertLabelModel } from '#/modules/label/label-db';
import { getIsoDate } from '#/utils/iso-date';

interface BuildPrimaryLabelRowsOpts {
  entries: PrimaryLabelDefinition[];
  projectId: string;
  organizationId: string;
  tenantId: string;
  createdBy: string | null;
}

/**
 * Build insertable tracked primary label rows for one project from the organization's
 * setupConfig entries. Array order becomes displayOrder; the first row is the default
 * primary label for new tasks in the project.
 */
export const buildPrimaryLabelRows = ({ entries, projectId, organizationId, tenantId, createdBy }: BuildPrimaryLabelRowsOpts): InsertLabelModel[] => {
  const createdAt = getIsoDate();
  return entries.map((entry, index) => ({
    entityType: 'label' as const,
    name: entry.name,
    slug: entry.slug,
    color: entry.color,
    icon: entry.icon,
    mode: 'primary' as const,
    organizationTracked: true,
    displayOrder: defaultOrder + index * orderGap,
    projectId,
    organizationId,
    tenantId,
    createdAt,
    createdBy,
    stx: createServerStx(),
  }));
};
