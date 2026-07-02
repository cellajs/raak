import { registerModule } from 'shared/module-registry';

registerModule({
  name: 'workspaces',
  owner: 'app',
  scope: ['frontend', 'backend'],
  description: `Endpoints for managing workspaces, which act as personal containers for organizing related
    projects. Each workspace is owned by a single user and is not shared with others. Workspaces
    enable users to bundle multiple projects into a private, logical grouping, offering better
    organization and separation across domains or contexts.`,
});
