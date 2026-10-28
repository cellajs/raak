import i18n from 'i18next';
import { FolderIcon } from 'lucide-react';
import type { RefObject } from 'react';
import type { Workspace } from 'sdk';
import { defineFrontendModule } from '~/lib/module';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { dangerToolBase, generalToolBase } from '~/modules/entities/channel-settings-tools';
import type { ChannelEnrichment } from '~/modules/entities/types';
import { CreateWorkspaceForm } from '~/modules/workspace/create-workspace-form';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { getRouter } from '~/routes/-router-instance';
import { getCreatedChannelRoute } from '~/utils/channel-route';
import { lazyNamed } from '~/utils/lazy-named';

const WorkspaceGeneralCard = lazyNamed(() => import('~/modules/workspace/settings-tools'), 'WorkspaceGeneralCard');
const WorkspaceDeleteCard = lazyNamed(() => import('~/modules/workspace/settings-tools'), 'WorkspaceDeleteCard');
const WorkspacesGrid = lazyNamed(() => import('~/modules/workspace/workspaces-grid'), 'WorkspacesGrid');

declare module '~/lib/placements' {
  interface ChannelEntityByType {
    workspace: Workspace & ChannelEnrichment;
  }
}

/** Opens the create dialog from the menu section's plus button and navigates to the new workspace. */
const createWorkspaceAction = (triggerRef: RefObject<HTMLButtonElement | null>, organizationId?: string) => {
  const handleCreated = (workspace: Workspace) => {
    getRouter().navigate(getCreatedChannelRoute('workspace', workspace));
  };

  const title = i18n.t('c:create_resource', { resource: i18n.t('c:workspace') });

  return dialoger.getState().create(<CreateWorkspaceForm organizationId={organizationId} callback={handleCreated} />, {
    className: 'md:max-w-2xl',
    id: 'create-workspace',
    description: i18n.t('c:create_workspace.text'),
    triggerRef,
    title,
    titleContent: <UnsavedBadge title={title} />,
  });
};

defineFrontendModule({
  name: 'workspaces',
  owner: 'app',
  scope: ['frontend'],
  description: 'UI for managing workspaces, personal containers that bundle related projects for a single user.',
  channel: {
    entityType: 'workspace',
    menuSection: { createAction: createWorkspaceAction, label: 'c:workspace_other', icon: FolderIcon },
    listQuery: (params) => workspacesListQueryOptions(params),
  },
  tools: [
    {
      ...generalToolBase,
      slot: 'workspace.settings',
      render: (workspace) => <WorkspaceGeneralCard workspace={workspace} />,
    },
    {
      ...dangerToolBase('workspace', 'c:workspace'),
      slot: 'workspace.settings',
      render: (workspace) => <WorkspaceDeleteCard workspace={workspace} />,
    },
    // Shortcuts to the user's workspaces on the home page; the section stays out of the way until a tile exists.
    {
      id: 'workspaces',
      label: 'c:workspace_other',
      slot: 'home.sections',
      render: () => (
        <section aria-labelledby="home-workspaces" className="mt-6 hidden has-[.tile-link]:block">
          <h2 id="home-workspaces" className="sr-only">
            {i18n.t('c:workspace_other')}
          </h2>
          <WorkspacesGrid />
        </section>
      ),
    },
  ],
});
