import { defineBackendModule } from '#/lib/module';
import { ensureUserWorkspace } from '#/modules/workspace/operations/ensure-workspace';
import { workspaceHandlers } from '#/modules/workspace/workspace-handlers';

defineBackendModule({
  name: 'workspaces',
  owner: 'app',
  scope: ['frontend', 'backend'],
  routes: [{ path: '/', app: workspaceHandlers, phase: 'absolute' }],
  // The menu lists a project under its workspace only, so a project without one would be out of sight.
  membershipColumns: async (ctx, { userId, entity }) => {
    if (entity.entityType !== 'project') return;
    return { workspaceId: await ensureUserWorkspace(ctx, { userId, organizationId: entity.organizationId }) };
  },
  description: `Endpoints for managing workspaces, which act as personal containers for organizing related
    projects. Each workspace is owned by a single user and is not shared with others. Workspaces
    enable users to bundle multiple projects into a private, logical grouping, offering better
    organization and separation across domains or contexts.`,
});
