import { defineFrontendModule } from '~/lib/module';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { lazyNamed } from '~/utils/lazy-named';

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
