import { createEntityHierarchy, createRoleRegistry } from '../src/config-builder/entity-hierarchy';

/******************************************************************************
 * ROLE REGISTRY
 ******************************************************************************/

/**
 * Single source of truth for all entity roles used in memberships and permissions.
 */
export const roles = createRoleRegistry(['admin', 'member', 'guest'] as const);

/******************************************************************************
 * ENTITY HIERARCHY
 ******************************************************************************/

/**
 * Entity relationships with single-parent inheritance. Kept separate from config.default.ts
 * so these types can be inferred before the config object is built.
 * Parents are defined before children. Order determines ancestor chain.
 *
 * Optional `relatedChannels` on products declare non-ancestor context references (nullable id columns).
 *
 * Public readability is NOT declared here: it is a permission concern, declared per
 * subject via `publicRead(mode)` in `permissions-config.ts`.
 */
export const hierarchy = createEntityHierarchy(roles)
  .user()
  .channel('organization', { parent: null, roles: ['admin', 'member'], })
  .channel('workspace', { parent: 'organization', roles: roles.all })
  .channel('project', { parent: 'organization', roles: roles.all })
  .product('task', { parent: 'project' })
  .product('label', { parent: 'project' })
  // Task-owned attachments reference their task via a plain nullable taskId data column
  // (declared in attachment-db.ts): relationships between products are data, never
  // permission indirection. deleteTasksOp cascades attachments in the same transaction.
  // Attachments without a task (taskId null) live at project level.
  .product('attachment', { parent: 'project' })
  .build();