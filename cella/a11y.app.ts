import { defineA11yApp, type SignedIn } from '@cellajs/cli/a11y';
import { getMyMemberships, getOrganizations, getProjects, getWorkspaces } from '../sdk/gen/index.ts';
import { apiClient } from './a11y.ts';

/** The organization the audit user administers, the first in their menu: settings and the invite dialog need that role. */
const administeredOrganization = async (user: SignedIn) => {
  const client = apiClient(user);
  const [{ items: organizations }, { items: memberships }] = await Promise.all([
    getOrganizations({ client, query: { limit: 50 } }),
    getMyMemberships({ client }),
  ]);
  const [administered] = memberships
    .filter((membership) => membership.channelType === 'organization' && membership.role === 'admin' && !membership.archived)
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const organization = organizations.find(({ id }) => id === administered?.channelId) ?? organizations[0];
  return organization ? { id: organization.id, path: `/${organization.tenantId}/${organization.slug}` } : null;
};

/**
 * Page path of a workspace or project in that organization: one the audit user administers when there is one, so its
 * cards are editable and the audit covers the edit affordances, else the first.
 */
const firstChannelPath = async (user: SignedIn, type: 'workspace' | 'project') => {
  const organization = await administeredOrganization(user);
  if (!organization) return null;
  const client = apiClient(user);
  const list = async (role?: 'admin') => {
    const query = { organizationId: organization.id, role, limit: 1 };
    const { items } = type === 'workspace' ? await getWorkspaces({ client, query }) : await getProjects({ client, query });
    return items;
  };
  const [channel] = [...(await list('admin')), ...(await list())];
  return channel ? `${organization.path}/${type}/${channel.slug}` : null;
};

export default defineA11yApp({
  placeholders: {
    workspace: (user) => firstChannelPath(user, 'workspace'),
    project: (user) => firstChannelPath(user, 'project'),
  },
  // raak's marketing pages have no sync engine page
  remove: ['sync-engine'],
  add: [
    { id: 'workspace-board', path: '{workspace}', auth: true },
    { id: 'project-board', path: '{project}', auth: true },
    { id: 'org-projects', path: '{org}/organization/projects', auth: true },
  ],
});
