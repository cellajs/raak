import type { ChannelEntityType } from 'shared';

export type ChannelRouteEntry = {
  /** Route path template for this entity: its canonical landing surface. Also the redirect
   *  target when the entity's tabbed layout route is visited directly (default tab). */
  path: string;
  /** Route param name this entity's slug fills (both as self and as ancestor) */
  paramName: string;
  /** Default search params for this entity route */
  search?: Record<string, string>;
  /** Preferred landing tab id when the layout route is visited without a tab; falls back to the
   *  first tab the channel's arrangement resolves when absent or disabled. */
  defaultTabId?: string;
  /** When shown as a subitem, navigate to a parent entity's route. */
  subitemOf?: { entityType: ChannelEntityType; searchParam: string };
  /** Search params a notification link on this channel opens with, e.g. a product's sheet id keyed by its entity type. */
  notificationSearch?: (notification: { entityType: string; subjectId: string }) => Record<string, string>;
};

/**
 * Unified route config for channel entities.
 *
 * Each entity declares its route path, its param name, and optional subitem behavior.
 * The param name is used both when the entity is the target AND when it appears as an
 * ancestor in another entity's route (e.g. organization's 'organizationSlug' appears in workspace routes).
 */
export const channelRouteConfig = {
  organization: {
    path: '/$tenantId/$organizationSlug/organization',
    paramName: 'organizationSlug',
    defaultTabId: 'attachments',
  },
  workspace: {
    path: '/$tenantId/$organizationSlug/workspace/$slug',
    paramName: 'slug',
  },
  project: {
    path: '/$tenantId/$organizationSlug/project/$slug',
    paramName: 'slug',
    subitemOf: { entityType: 'workspace', searchParam: 'projectSlug' },
    // The project board reads `taskSheetId` and opens that task's sheet on top of the board.
    notificationSearch: ({ entityType, subjectId }): Record<string, string> =>
      entityType === 'task' ? { taskSheetId: subjectId } : {},
  },
} as const satisfies Record<ChannelEntityType, ChannelRouteEntry>;
