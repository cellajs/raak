import type { ChannelEntityType } from 'shared';
import type { ChannelRouteEntry } from '~/utils/channel-route';

export const channelRouteConfig = {
  organization: { path: '/$tenantId/$organizationSlug/organization', paramName: 'organizationSlug' },
  workspace: { path: '/$tenantId/$organizationSlug/workspace/$slug', paramName: 'slug' },
  project: {
    path: '/$tenantId/$organizationSlug/project/$slug',
    paramName: 'slug',
    subitemOf: { entityType: 'workspace', searchParam: 'projectSlug' },
  },
} as const satisfies Record<ChannelEntityType, ChannelRouteEntry>;
