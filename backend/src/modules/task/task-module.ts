import { registerModule } from 'shared/module-registry';

registerModule({
  name: 'tasks',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing tasks, which represent actionable items of work within a project. Tasks
    support labeling, assignment, and status tracking, and are strictly scoped to their parent project.`,
});
