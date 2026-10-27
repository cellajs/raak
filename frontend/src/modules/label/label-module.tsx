import { defineFrontendModule } from '~/lib/module';
import { lazyNamed } from '~/utils/lazy-named';
// Registers the mutation defaults before the cache restore, so a queued label mutation replays after a reload
import '~/modules/label/query';

const PrimaryLabelsCard = lazyNamed(() => import('~/modules/label/primary-labels-card'), 'PrimaryLabelsCard');

defineFrontendModule({
  name: 'labels',
  owner: 'app',
  scope: ['frontend'],
  description: 'UI for creating, assigning, and filtering labels used to categorize tasks within a project.',
  tools: [
    {
      slot: 'organization.settings',
      id: 'task-types',
      label: 'c:primary_labels',
      requires: 'update',
      render: (organization) => <PrimaryLabelsCard organization={organization} />,
    },
  ],
});
