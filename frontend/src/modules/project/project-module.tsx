import { defineFrontendModule } from '~/lib/module';
import { channelSettingsTools } from '~/modules/entities/channel-settings-tools';
import type { EnrichedProject } from '~/modules/project/types';
import { lazyNamed } from '~/utils/lazy-named';

const ProjectGeneralForm = lazyNamed(() => import('~/modules/project/settings-tools'), 'ProjectGeneralForm');
const ProjectWorkspaceCard = lazyNamed(() => import('~/modules/project/settings-tools'), 'ProjectWorkspaceCard');
const ProjectMembershipCard = lazyNamed(() => import('~/modules/project/settings-tools'), 'ProjectMembershipCard');
const ProjectToolsCard = lazyNamed(() => import('~/modules/project/settings-tools'), 'ProjectToolsCard');
const ProjectDeleteDialog = lazyNamed(() => import('~/modules/project/settings-tools'), 'ProjectDeleteDialog');

declare module '~/lib/placements' {
  interface ChannelEntityByType {
    project: EnrichedProject;
  }
}

defineFrontendModule({
  name: 'projects',
  owner: 'app',
  scope: ['frontend'],
  description:
    'UI for managing projects, the primary collaborative contexts containing tasks, labels, and attachments.',
  tools: [
    // The factory ships the general form ungated; project settings open for every member, so
    // the form itself is held to the update grant (org admins included, unlike the old
    // direct-membership admin check).
    ...channelSettingsTools({
      channelType: 'project',
      resource: 'c:project',
      toolsCardVisibleTo: ['organization.admin', 'project.admin'],
      renderGeneral: (project) => <ProjectGeneralForm project={project} />,
      renderTools: (project) => <ProjectToolsCard project={project} />,
      renderDeleteDialog: (project) => <ProjectDeleteDialog project={project} />,
    }).map((tool) => (tool.id === 'general' ? { ...tool, requires: 'update' } : tool)),
    {
      slot: 'project.settings',
      id: 'workspace',
      label: 'c:workspace',
      order: 30,
      render: (project) => <ProjectWorkspaceCard project={project} />,
    },
    {
      slot: 'project.settings',
      id: 'membership',
      label: 'c:project_membership',
      order: 40,
      render: (project) => <ProjectMembershipCard project={project} />,
    },
  ],
});
