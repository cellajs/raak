import type { OrganizationSettingsSection } from '~/modules/organization/types';
import { UpdatePrimaryLabelsForm } from '~/modules/organization/update-primary-labels-form';

/**
 * Fork-provided cards for the organization settings page, inserted between the built-in details and
 * delete sections and shown as page-aside tabs.
 *
 * raak adds a primary-labels editor that reads `organization.setupConfig.primaryLabels`.
 */
export const organizationSettingsSections: OrganizationSettingsSection[] = [
  {
    id: 'update-primary-labels',
    label: 'c:primary_labels',
    render: (organization) => <UpdatePrimaryLabelsForm organization={organization} />,
  },
];
