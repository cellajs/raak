import { textFromDocument } from 'shared/blocknote';
import { defineBackendModule } from '#/lib/module';
import { taskTitle } from '#/modules/task/helpers/task-title';
import { updateTaskOp } from '#/modules/task/operations/update-task';
import { publicTaskHandlers } from '#/modules/task/public-handlers';
import { taskRedirectHandlers } from '#/modules/task/redirect-handlers';
import { taskHandlers } from '#/modules/task/task-handlers';
import { findTaskNotificationPreview, findTaskNotificationTitles } from '#/modules/task/task-queries';

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
  notifications: {
    async loadPreview(tx, subjectId) {
      const row = await findTaskNotificationPreview(tx, subjectId);
      if (!row) return null;
      return { title: taskTitle(row), body: textFromDocument(row.description) ?? row.description ?? '' };
    },
    async loadContextNames(tx, ids) {
      const rows = await findTaskNotificationTitles(tx, ids);
      return new Map(rows.map((row) => [row.id, taskTitle(row)]));
    },
  },
});
