import { defineBackendModule } from '#/lib/module';
import { projectHandlers } from '#/modules/project/project-handlers';
import { publicProjectHandlers } from '#/modules/project/public-handlers';

defineBackendModule({
  name: 'projects',
  owner: 'app',
  scope: ['frontend', 'backend'],
  routes: [
    { path: '/public/projects', app: publicProjectHandlers },
    { path: '/', app: projectHandlers, phase: 'absolute' },
  ],
  description: `Endpoints for managing projects, which are the primary collaborative contexts containing
    tasks, labels, and attachments. Every project belongs to exactly one organization, which defines its
    access scope and ownership. Projects support multiple members and permission based collaboration.`,
});
