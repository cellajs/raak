import { defineBackendModule } from '#/lib/module';
import { updateTaskOp } from '#/modules/task/operations/update-task';

defineBackendModule({
  name: 'tasks',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing tasks, which represent actionable items of work within a project. Tasks
    support labeling, assignment, and status tracking, and are strictly scoped to their parent project.`,
  entity: 'task',
  yjsMaterializer: updateTaskOp,
});
