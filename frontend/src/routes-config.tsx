import type { ChannelEntityType } from 'shared';

export type EntityRouteEntry = {
  /** Route path template for this entity: its canonical landing surface. Also the redirect
   *  target when the entity's tabbed layout route is visited directly (default tab). */
  path: string;
  /** Route param name this entity's slug fills (both as self and as ancestor) */
  paramName: string;
  /** Default search params for this entity route */
  search?: Record<string, string>;
  /** When shown as a subitem, navigate to a parent entity's route. */
  subitemOf?: { entityType: ChannelEntityType; searchParam: string };
};

/**
 * Unified route config for channel entities.
 *
 * Each entity declares its route path, its param name, and optional subitem behavior.
 * The param name is used both when the entity is the target AND when it appears as an
 * ancestor in another entity's route (e.g. organization's 'organizationSlug' appears in workspace routes).
 */
export const entityRouteConfig = {
  organization: {
    path: '/$tenantId/$organizationSlug/organization/attachments',
    paramName: 'organizationSlug',
  },
  workspace: {
    path: '/$tenantId/$organizationSlug/workspace/$slug',
    paramName: 'slug',
  },
  project: {
    path: '/$tenantId/$organizationSlug/project/$slug',
    paramName: 'slug',
    subitemOf: { entityType: 'workspace', searchParam: 'projectSlug' },
  },
} as const satisfies Record<ChannelEntityType, EntityRouteEntry>;
