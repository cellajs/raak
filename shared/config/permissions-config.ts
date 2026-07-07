import { appConfig } from '../src/config-builder/app-config';
import { configurePermissions } from '../src/permissions/access-policies';

/**
 * Access policies for each entity type: CRUD permissions per role within each context.
 * See `README.md` in this directory for the elevation vs. self row model and the entity
 * onboarding checklist.
 */
export const { accessPolicies, publicReadGrants, rowRestrictions, hostDelegation } = configurePermissions(
  appConfig.entityTypes,
  ({ subject, contexts, publicRead, delegateToHost }) => {
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
      // Public read: readable by anyone when the parent project's publicAt is set
      publicRead('publicParent');
      // Host delegation: a task-owned attachment is readable by whoever can read its task
      // (host row resolved at check time). Additive with the cells below.
      delegateToHost(['read']);
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
      break;
    case 'task':
      // Public read: readable by anyone when the parent project's publicAt is set
      publicRead('publicParent');
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.organization.member({ create: 0, read: 0, update: 0, delete: 0 });
      contexts.project.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.project.member({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.project.guest({ create: 0, read: 1, update: 0, delete: 0 });
      break;
  }
  },
);
