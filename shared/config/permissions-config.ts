import { appConfig } from '../src/config-builder/app-config';
import { configurePermissions } from '../src/permissions/policy-matrix';


/**
 * Grant scoping for PRODUCT entities (optional). When a role list is configured, a product
 * membership grant of a role NOT in the list speaks only for rows HOMED at its own channel
 * level, while listed roles keep full subtree scope. `undefined` (the template default)
 * keeps every grant subtree-scoped, which is raak's current behavior. Revisit if
 * project-level roles (e.g. guest) should stop seeing workspace-nested rows.
 */
export const elevatedRoles: readonly string[] | undefined = undefined;

/**
 * Policy matrix for each entity type: CRUD permissions per role within each channel.
 * See `README.md` in this directory for the elevation vs. self row model and the entity
 * onboarding checklist.
 */
export const { policyMatrix, publicReadGrants } = configurePermissions(
  appConfig.entityTypes,
  ({ entityType, channels, publicRead }) => {
    switch (entityType) {
      case 'organization':
        channels.organization.admin({ read: 1, update: 1, delete: 1 });
        channels.organization.member({ read: 1, update: 0, delete: 0 });
        break;
      case 'workspace':
        channels.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
        channels.organization.member({ create: 1, read: 1, update: 0, delete: 0 });

        channels.workspace.admin({ read: 1, update: 1, delete: 1 });
        channels.workspace.member({ read: 1, update: 0, delete: 0 });
        channels.workspace.guest({ read: 0, update: 0, delete: 0 });
        break;
      case 'project':
        publicRead();
        channels.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
        channels.organization.member({ create: 1, read: 1, update: 0, delete: 0 });

        channels.project.admin({ read: 1, update: 1, delete: 1 });
        channels.project.member({ read: 1, update: 0, delete: 0 });
        channels.project.guest({ read: 1, update: 0, delete: 0 });
        break;
      case 'attachment':
        publicRead();
        channels.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
        channels.organization.member({ create: 1, read: 'own', update: 0, delete: 0 });

        channels.project.admin({ create: 1, read: 1, update: 1, delete: 1 });
        channels.project.member({ create: 1, read: 1, update: 0, delete: 1 });
        channels.project.guest({ create: 0, read: 1, update: 0, delete: 0 });
        break;
      case 'label':
        channels.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
        channels.organization.member({ create: 0, read: 0, update: 0, delete: 0 });

        channels.project.admin({ create: 1, read: 1, update: 1, delete: 1 });
        channels.project.member({ create: 1, read: 1, update: 1, delete: 1 });
        channels.project.guest({ create: 0, read: 0, update: 0, delete: 0 });
        break;
      case 'task':
        publicRead();
        channels.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
        channels.organization.member({ create: 0, read: 0, update: 0, delete: 0 });
        
        channels.project.admin({ create: 1, read: 1, update: 1, delete: 1 });
        channels.project.member({ create: 1, read: 1, update: 1, delete: 1 });
        channels.project.guest({ create: 0, read: 1, update: 0, delete: 0 });
        break;
    }
  },
);
