import { defineBackendModule } from '#/lib/module';
import { updateTaskOp } from '#/modules/task/operations/update-task';
import { publicTaskHandlers } from '#/modules/task/public-handlers';
import { taskRedirectHandlers } from '#/modules/task/redirect-handlers';
import { taskHandlers } from '#/modules/task/task-handlers';

defineBackendModule({
  name: 'tasks',
  owner: 'app',
  scope: ['frontend', 'backend'],
  routes: [
    { path: '/public/tasks', app: publicTaskHandlers },
    { path: '/t', app: taskRedirectHandlers },
    { path: '/:tenantId/:organizationId/tasks', app: taskHandlers, phase: 'tenant' },
  ],
  description: `Endpoints for managing tasks, which represent actionable items of work within a project. Tasks
    support labeling, assignment, and status tracking, and are strictly scoped to their parent project.`,
  productEntity: 'task',
  yjsMaterializer: updateTaskOp,
  notifications: true,
});
