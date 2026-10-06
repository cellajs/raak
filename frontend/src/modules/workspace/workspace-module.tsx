import i18n from 'i18next';
import { FolderIcon } from 'lucide-react';
import type { RefObject } from 'react';
import type { Workspace } from 'sdk';
import { defineFrontendModule } from '~/lib/module';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import type { ChannelEnrichment } from '~/modules/entities/types';
import { CreateWorkspaceForm } from '~/modules/workspace/create-workspace-form';
import { workspacesListQueryOptions } from '~/modules/workspace/query';
import { getRouter } from '~/routes/-router-instance';
import { getCreatedChannelRoute } from '~/utils/channel-route';

declare module '~/lib/placements' {
  interface ChannelEntityByType {
    workspace: Workspace & ChannelEnrichment;
  }
}

/** Opens the create dialog from the menu section's plus button and lands on the new workspace. */
const createWorkspaceAction = (triggerRef: RefObject<HTMLButtonElement | null>) => {
  const callback = (workspace: Workspace) => {
    getRouter().navigate(getCreatedChannelRoute('workspace', workspace));
  };

  const title = i18n.t('c:create_resource', { resource: i18n.t('c:workspace').toLowerCase() });

  return useDialoger.getState().create(<CreateWorkspaceForm dialog callback={callback} />, {
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
});
