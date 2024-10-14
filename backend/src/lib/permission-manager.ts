// Import required modules from '@cellajs/permission-manager'
import {
  type AccessPolicyConfiguration,
  Context as EntityContext,
  HierarchicalEntity,
  type Membership,
  MembershipAdapter,
  PermissionManager,
  Product,
  type Subject,
  SubjectAdapter,
} from '@cellajs/permission-manager';
import { config } from 'config';
import type { Context } from 'hono';
import type { MembershipModel } from '#/db/schema/memberships';
import type { ContextEntity } from '#/types/common';
import { getContextUser, getMemberships } from './context';
import { type EntityModel, resolveEntity } from './entity';
import { errorResponse } from './errors';

/**
 * Define hierarchical structure for contexts with roles, and for products without roles.
 */
const organization = new EntityContext('organization', ['admin', 'member']);
new EntityContext('workspace', ['admin', 'member'], new Set([organization]));
const project = new EntityContext('project', ['admin', 'member'], new Set([organization]));

new Product('task', new Set([project]));

/**
 * Initialize the PermissionManager and configure access policies.
 */
const permissionManager = new PermissionManager('permissionManager');

permissionManager.accessPolicies.configureAccessPolicies(({ subject, contexts }: AccessPolicyConfiguration) => {
  // Configure actions based on the subject (organization or workspace)
  switch (subject.name) {
    case 'organization':
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.organization.member({ create: 0, read: 1, update: 0, delete: 0 });
      break;
    case 'workspace':
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.workspace.admin({ create: 0, read: 1, update: 1, delete: 1 });
      contexts.workspace.member({ create: 0, read: 1, update: 0, delete: 0 });
      break;
    case 'project':
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.project.admin({ create: 0, read: 1, update: 1, delete: 1 });
      contexts.project.member({ create: 0, read: 1, update: 0, delete: 0 });
      break;
    case 'task':
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.project.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.project.member({ create: 1, read: 1, update: 1, delete: 1 });
      break;
  }
});

/**
 * Adapter for transforming raw membership data into the expected Membership format.
 */
class AdaptedMembershipAdapter extends MembershipAdapter {
  /**
   * Adapt raw membership data to the Membership format.
   * @param memberships - Array of raw membership data.
   * @returns Array of adapted Membership objects.
   */

  // biome-ignore lint/suspicious/noExplicitAny: The format of the membership object may vary.
  adapt(memberships: any[]): Membership[] {
    return memberships.map((m) => ({
      contextName: m.type?.toLowerCase() || '',
      contextKey: m[`${m.type?.toLowerCase() || ''}Id`],
      roleName: m.role,
      ancestors: {
        organization: m.organizationId,
        workspace: m.workspaceId,
        project: m.projectId,
      },
    }));
  }
}

/**
 * Adapter for transforming raw subject data into the expected Subject format.
 */
class AdaptedSubjectAdapter extends SubjectAdapter {
  /**
   * Adapt raw subject data to the Subject format.
   * @param s - Raw subject data.
   * @returns Adapted Subject object.
   */

  // biome-ignore lint/suspicious/noExplicitAny: The format of the subject can vary depending on the subject.
  adapt(s: any): Subject {
    return {
      name: s.entity,
      key: s.id,
      ancestors: {
        organization: s.organizationId,
        workspace: s.workspaceId,
        project: s.projectId,
      },
    };
  }
}

// Instantiate adapters to be used in the system
new AdaptedSubjectAdapter();
new AdaptedMembershipAdapter();

export const isAllowedTo = async <T extends ContextEntity>(
  ctx: Context,
  entityType: T,
  action: 'read' | 'update' | 'delete',
  idOrSlug: string,
): Promise<
  | {
      error: ReturnType<typeof errorResponse>;
      entity: null;
      membership: null;
    }
  | {
      error: null;
      entity: EntityModel<T>;
      membership: MembershipModel;
    }
> => {
  if (!config.contextEntityTypes.includes(entityType)) {
    return {
      error: errorResponse(ctx, 403, 'forbidden', 'warn'),
      entity: null,
      membership: null,
    };
  }

  const entity = await resolveEntity(entityType, idOrSlug);

  const user = getContextUser();
  const memberships = getMemberships();

  // Check if the user is allowed to perform an update action in the organization
  const isAllowed = permissionManager.isPermissionAllowed(memberships, action, entity);

  if (!entity || (!isAllowed && user.role !== 'admin')) {
    return {
      error: errorResponse(ctx, 403, 'forbidden', 'warn'),
      entity: null,
      membership: null,
    };
  }

  const entityMembership = memberships.find((m) => [m.organizationId, m.workspaceId, m.projectId].includes(entity.id) && m.type === entityType);

  if (!entityMembership) {
    return {
      error: errorResponse(ctx, 403, 'forbidden', 'warn'),
      entity: null,
      membership: null,
    };
  }

  return {
    error: null,
    entity,
    membership: entityMembership,
  };
};

// Export the configured PermissionManager instance
export default permissionManager;
export { HierarchicalEntity };
