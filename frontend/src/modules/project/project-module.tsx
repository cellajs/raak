import { defineFrontendModule } from '~/lib/module';
import { dangerToolBase, generalToolBase } from '~/modules/entities/channel-settings-tools';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { lazyNamed } from '~/utils/lazy-named';

const ProjectGeneralCard = lazyNamed(() => import('~/modules/project/settings-tools'), 'ProjectGeneralCard');
const ProjectWorkspaceCard = lazyNamed(() => import('~/modules/project/settings-tools'), 'ProjectWorkspaceCard');
const ProjectMembershipCard = lazyNamed(() => import('~/modules/project/settings-tools'), 'ProjectMembershipCard');
const ProjectDeleteCard = lazyNamed(() => import('~/modules/project/settings-tools'), 'ProjectDeleteCard');
const ProjectsGrid = lazyNamed(() => import('~/modules/project/projects-grid'), 'ProjectsGrid');

declare module '~/lib/placements' {
  interface ChannelEntityByType {
    project: EnrichedProject;
  }
}

defineFrontendModule({
  name: 'projects',
  owner: 'app',
  scope: ['frontend'],
  description: 'UI for managing projects, the primary collaborative contexts containing tasks, labels, and attachments.',
  channel: {
    entityType: 'project',
    listQuery: (params) => projectsListQueryOptions(params),
  },
  tools: [
    {
      ...generalToolBase,
      slot: 'project.settings',
      render: (project) => <ProjectGeneralCard project={project} />,
    },
    // Workspace placement and leaving are the viewer's own membership: a project's stored arrangement cannot hide them.
    {
      id: 'workspace',
      label: 'c:workspace',
      order: 30,
      locked: true,
      slot: 'project.settings',
      render: (project) => <ProjectWorkspaceCard project={project} />,
    },
    {
      id: 'membership',
      label: 'c:project_membership',
      order: 85,
      locked: true,
      slot: 'project.settings',
      render: (project) => <ProjectMembershipCard project={project} />,
    },
    {
      ...dangerToolBase('project', 'c:project'),
      slot: 'project.settings',
      render: (project) => <ProjectDeleteCard project={project} />,
    },
    // The projects a user is a member of, on their profile: inside an organization, the ones in that organization.
    {
      id: 'projects',
      label: 'c:project_other',
      slot: 'user.profile',
      order: 40,
      render: ({ user, organizationId, isSheet }) => (
        <div className="container">
          <ProjectsGrid
            fixedQuery={{ relatableUserId: user.id, organizationId, include: 'counts' }}
            saveDataInSearch={!isSheet}
            focusView={!isSheet}
          />
        </div>
      ),
    },
  ],
});
