/**
 * Entity hierarchy and role registry definitions.
 * Separated from default-config.ts to enable type inference before config object creation.
 */
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
 * Entity relationships with single-parent inheritance.
 * Parents are defined before children. Order determines ancestor chain.
 *
 * Optional `relatedContexts` on products declare non-ancestor context references (nullable id columns).
 *
 * Public readability is NOT declared here — it is a permission concern, declared per
 * subject via `publicRead(mode)` in `permissions-config.ts`.
 */
export const hierarchy = createEntityHierarchy(roles)
  .user()
  .context('organization', { parent: null, roles: ['admin', 'member'], })
  .context('workspace', { parent: 'organization', roles: roles.all })
  .context('project', { parent: 'organization', roles: roles.all })
  .product('task', { parent: 'project' })
  .product('label', { parent: 'project' })
  // host: task-owned attachments (nullable taskId column) — deleting a task cascades to
  // them, and CDC maintains e:attachment counts per task. Unhosted attachments (taskId
  // null) live at project level as before.
  .product('attachment', { parent: 'project', host: 'task' })
  .build();