import { defineBackendModule } from '#/lib/module';
import { workspaceHandlers } from '#/modules/workspace/workspace-handlers';

defineBackendModule({
  name: 'workspaces',
  owner: 'app',
  scope: ['frontend', 'backend'],
  routes: [{ path: '/', app: workspaceHandlers, phase: 'absolute' }],
  description: `Endpoints for managing workspaces, which act as personal containers for organizing related
    projects. Each workspace is owned by a single user and is not shared with others. Workspaces
    enable users to bundle multiple projects into a private, logical grouping, offering better
    organization and separation across domains or contexts.`,
});
