import { defineFrontendModule } from '~/lib/module';
import { ToolCard } from '~/modules/common/tool-card';
import { lazyNamed } from '~/utils/lazy-named';

const UpdatePrimaryLabelsForm = lazyNamed(
  () => import('~/modules/organization/update-primary-labels-form'),
  'UpdatePrimaryLabelsForm',
);

defineFrontendModule({
  name: 'labels',
  owner: 'app',
  scope: ['frontend'],
  description: 'UI for creating, assigning, and filtering labels used to categorize tasks within a project.',
  tools: [
    {
      slot: 'organization.settings',
      id: 'update-primary-labels',
      label: 'c:primary_labels',
      visibleTo: ['organization.admin'],
      render: (organization) => (
        <ToolCard label="c:primary_labels" id="update-primary-labels">
          <UpdatePrimaryLabelsForm organization={organization} />
        </ToolCard>
      ),
    },
  ],
});
