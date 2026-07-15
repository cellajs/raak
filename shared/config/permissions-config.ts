import { appConfig } from '../src/config-builder/app-config';
import { configurePermissions } from '../src/permissions/access-policies';

/**
 * Access policies for each entity type: CRUD permissions per role within each context.
 * See `README.md` in this directory for the elevation vs. self row model and the entity
 * onboarding checklist.
 */
/**
 * Grant scoping for PRODUCT entities (optional). When a role list is configured, a product
 * membership grant of a role NOT in the list speaks only for rows HOMED at its own context
 * level, while listed roles keep full subtree scope. `undefined` (the template default)
 * keeps every grant subtree-scoped — raak's current behavior. Revisit if project-level
 * roles (e.g. guest) should stop seeing workspace-nested rows.
 */
export const elevatedRoles: readonly string[] | undefined = undefined;

export const { accessPolicies, publicReadGrants } = configurePermissions(
  appConfig.entityTypes,
  ({ subject, contexts, publicRead }) => {
  switch (subject.name) {
    case 'organization':
      // self (this organization): create is inert here, org creation is gated by tenant quota, not this policy
      contexts.organization.admin({ read: 1, update: 1, delete: 1 });
      contexts.organization.member({ read: 1, update: 0, delete: 0 });
      break;
    case 'workspace':
      // elevation (parent org): create grants the right to make a workspace inside the org
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.organization.member({ create: 1, read: 1, update: 0, delete: 0 });
      // self (this workspace): create omitted, you can't create a workspace from inside itself
      contexts.workspace.admin({ read: 1, update: 1, delete: 1 });
      contexts.workspace.member({ read: 1, update: 0, delete: 0 });
      contexts.workspace.guest({ read: 0, update: 0, delete: 0 });
      break;
    case 'project':
      // Public read: a project becomes readable by anyone once its own publicAt is set
      publicRead('publicSelf');
      // elevation (parent org): create grants the right to make a project inside the org
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.organization.member({ create: 1, read: 1, update: 0, delete: 0 });
      // self (this project): create omitted, you can't create a project from inside itself
      contexts.project.admin({ read: 1, update: 1, delete: 1 });
      contexts.project.member({ read: 1, update: 0, delete: 0 });
      contexts.project.guest({ read: 1, update: 0, delete: 0 });
      break;
    case 'attachment':
      // Public read: readable by anyone once the row's own publicAt is set. publicAt is
      // denormalized from the parent project (create path + cascade trigger), so an
      // attachment under a public project is publicly readable.
      publicRead('publicSelf');
      // Task-owned attachments need no task-based read delegation: every role that can
      // read a task already reads attachments via the cells below (project roles + org
      // admin), and org members keep read:'own'. Rows are self-describing.
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      // read: 'own' means org members may read/list attachments they created anywhere in the
      // org (row condition), even in projects they are not a member of.
      contexts.organization.member({ create: 1, read: 'own', update: 0, delete: 0 });
      contexts.project.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.project.member({ create: 1, read: 1, update: 0, delete: 1 });
      contexts.project.guest({ create: 0, read: 1, update: 0, delete: 0 });
      break;
    case 'label':
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.organization.member({ create: 0, read: 0, update: 0, delete: 0 });
      contexts.project.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.project.member({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.project.guest({ create: 0, read: 0, update: 0, delete: 0 });
      break;
    case 'task':
      // Public read: readable by anyone once the row's own publicAt is set. publicAt is
      // denormalized from the parent project (create path + cascade trigger), so a task
      // under a public project is publicly readable (backs public share links).
      publicRead('publicSelf');
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.organization.member({ create: 0, read: 0, update: 0, delete: 0 });
      contexts.project.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.project.member({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.project.guest({ create: 0, read: 1, update: 0, delete: 0 });
      break;
  }
  },
);
