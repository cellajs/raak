import type { Workspace } from 'sdk';
import { defineFrontendModule } from '~/lib/module';
import { channelSettingsTools } from '~/modules/entities/channel-settings-tools';
import type { ChannelEnrichment } from '~/modules/entities/types';
import { lazyNamed } from '~/utils/lazy-named';

const WorkspaceGeneralForm = lazyNamed(() => import('~/modules/workspace/settings-tools'), 'WorkspaceGeneralForm');
const WorkspaceToolsCard = lazyNamed(() => import('~/modules/workspace/settings-tools'), 'WorkspaceToolsCard');
const WorkspaceDangerCard = lazyNamed(() => import('~/modules/workspace/settings-tools'), 'WorkspaceDangerCard');

declare module '~/lib/placements' {
  interface ChannelEntityByType {
    workspace: Workspace & ChannelEnrichment;
  }
}

defineFrontendModule({
  name: 'workspaces',
  owner: 'app',
  scope: ['frontend'],
  description: 'UI for managing workspaces, personal containers that bundle related projects for a single user.',
  tools: [
    // The standard danger tool is replaced below: the workspace notice explains projects
    // survive deletion, and delete is blocked for the actor's only workspace.
    ...channelSettingsTools({
      channelType: 'workspace',
      resource: 'c:workspace',
      toolsCardVisibleTo: ['organization.admin', 'workspace.admin'],
      renderGeneral: (workspace) => <WorkspaceGeneralForm workspace={workspace} />,
      renderTools: (workspace) => <WorkspaceToolsCard workspace={workspace} />,
      renderDeleteDialog: () => null,
    }).flatMap((tool) => {
      if (tool.id === 'general') return [{ ...tool, requires: 'update' }];
      if (tool.id === 'delete-workspace') return [];
      return [tool];
    }),
    {
      slot: 'workspace.settings',
      id: 'delete-workspace',
      label: 'c:delete_resource',
      resource: 'c:workspace',
      order: 90,
      locked: true,
      requires: 'delete',
      render: (workspace) => <WorkspaceDangerCard workspace={workspace} />,
    },
  ],
});
