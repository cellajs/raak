import { registerModule } from 'shared/module-registry';

registerModule({
  name: 'labels',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing labels, which are lightweight, user defined tags assigned to tasks.
    Labels help categorize and filter tasks (for example client, api, or backend). They exist at the
    project level and are available to all members of the project.`,
});
