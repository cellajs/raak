import { appConfig } from '../src/config-builder/app-config';
import { configurePermissions } from '../src/permissions/policy-matrix';

/**
 * Policy matrix for each entity type: CRUD permissions per role within each channel.
 * See `README.md` in this directory for the elevation vs. self row model and the entity
 * onboarding checklist.
 */
/**
 * Grant scoping for PRODUCT entities (optional). When a role list is configured, a product
 * membership grant of a role NOT in the list speaks only for rows HOMED at its own channel
 * level, while listed roles keep full subtree scope. `undefined` (the template default)
 * keeps every grant subtree-scoped, which is raak's current behavior. Revisit if
 * project-level roles (e.g. guest) should stop seeing workspace-nested rows.
 */
export const elevatedRoles: readonly string[] | undefined = undefined;

export const { policyMatrix, publicReadGrants } = configurePermissions(
  appConfig.entityTypes,
  ({ entityType, channels, publicRead }) => {
    switch (entityType) {
      case 'organization':
        // self (this organization): create is inert here, org creation is gated by tenant quota, not this policy
        channels.organization.admin({ read: 1, update: 1, delete: 1 });
        channels.organization.member({ read: 1, update: 0, delete: 0 });
        break;
      case 'workspace':
        // elevation (parent org): create grants the right to make a workspace inside the org
        channels.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
        channels.organization.member({ create: 1, read: 1, update: 0, delete: 0 });
        // self (this workspace): create omitted, you can't create a workspace from inside itself
        channels.workspace.admin({ read: 1, update: 1, delete: 1 });
        channels.workspace.member({ read: 1, update: 0, delete: 0 });
        channels.workspace.guest({ read: 0, update: 0, delete: 0 });
        break;
      case 'project':
        // Public read: a project becomes readable by anyone once its own publicAt is set
        publicRead();
        // elevation (parent org): create grants the right to make a project inside the org
        channels.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
        channels.organization.member({ create: 1, read: 1, update: 0, delete: 0 });
        // self (this project): create omitted, you can't create a project from inside itself
        channels.project.admin({ read: 1, update: 1, delete: 1 });
        channels.project.member({ read: 1, update: 0, delete: 0 });
        channels.project.guest({ read: 1, update: 0, delete: 0 });
        break;
      case 'attachment':
        // Public read: readable by anyone once the row's own publicAt is set. publicAt is
        // denormalized from the parent project (create path + cascade trigger), so an
        // attachment under a public project is publicly readable.
        publicRead();
        // Task-owned attachments need no task-based read delegation: every role that can
        // read a task already reads attachments via the cells below (project roles + org
        // admin), and org members keep read:'own'. Rows are self-describing.
        channels.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
        // read: 'own' means org members may read/list attachments they created anywhere in the
        // org (row condition), even in projects they are not a member of.
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
        // Public read: readable by anyone once the row's own publicAt is set. publicAt is
        // denormalized from the parent project (create path + cascade trigger), so a task
        // under a public project is publicly readable (backs public share links).
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
