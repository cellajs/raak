import { defineFrontendModule } from '~/lib/module';

defineFrontendModule({
  name: 'tasks',
  owner: 'app',
  scope: ['frontend'],
  description: 'UI for managing tasks, including labeling, assignment, and status tracking within a project.',
});
