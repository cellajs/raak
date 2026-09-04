// Split from config.default.ts so its types can be inferred before the config object is built.
import { createEntityHierarchy, createRoleRegistry } from '../src/config-builder/entity-hierarchy.ts';

/** Single source of truth for all entity roles used in memberships and permissions. */
export const roles = createRoleRegistry(['admin', 'member', 'guest'] as const);

/**
 * Entity relationships, single-parent inheritance. The organization is the spine (`organization()`,
 * the only parentless entity); parents before children, and order sets the ancestor chain. Products
 * may add `relatedChannels` (non-ancestor context refs, nullable id columns). Public readability is
 * a permission concern, not declared here. Channels may add `elevated` (roles whose product grants
 * cover the whole subtree, compiled into `hierarchy.elevatedGrants`); channels below the organization
 * may add `organizationRoles` (the complete escalation map for auto-created organization membership rows).
 *
 * @see cella/PERMISSIONS.md
 */
export const hierarchy = createEntityHierarchy(roles)
  .user()
  .organization({ roles: ['admin', 'member'], elevated: ['admin', 'member'] })
  // Invites to a workspace or project auto-create the organization membership as a plain member.
  .channel('workspace', {
    parent: 'organization',
    roles: roles.all,
    organizationRoles: { admin: 'member', member: 'member', guest: 'member' },
  })
  .channel('project', {
    parent: 'organization',
    roles: roles.all,
    organizationRoles: { admin: 'member', member: 'member', guest: 'member' },
  })
  .product('task', { parent: 'project' })
  .product('label', { parent: 'project' })
  // Attachments are referenced by tasks via the derived task.attachments id array
  // (an owned-lifecycle productEmbedding mirroring description media blocks):
  // relationships between products are data, never permission indirection. The CDC
  // worker garbage-collects attachment rows no live task references and cascades
  // them on task deletion; rows never referenced by a host array stay project-level.
  .product('attachment', { parent: 'project' })
  .build();
