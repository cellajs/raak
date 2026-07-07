import { appConfig } from '../src/config-builder/app-config';
import { configurePermissions } from '../src/permissions/access-policies';

/**
 * Access policies for each entity type.
 *
 * Policies define CRUD permissions per role within each context.
 * Values: `1` = allowed, `0` = denied. Any action you omit defaults to `0` (denied), so a row
 * only needs to list the actions it grants.
 *
 * ## Elevation vs. self rows (context entities)
 *
 * For a context entity (organization, workspace, project), its policy has two kinds of rows:
 * - **elevation** rows on an *ancestor* context (e.g. `organization.*` under `project`): what a
 *   member of the parent can do to children. `create` lives here — it grants making the child.
 * - **self** rows on the *same* context (e.g. `project.*` under `project`): what a member of the
 *   entity can do to that entity. `create` is omitted on self rows because you can't create an
 *   entity from inside itself.
 *
 * Product entities have no self rows: their context rows are *home* rows, where `create` is
 * meaningful (it grants creating the product inside that context).
 *
 * ## Adding new entities
 *
 * Defining access policies (a `case` in the switch below) is only one step of adding an entity.
 * For the full end-to-end recipe — hierarchy declaration, config arrays, DB table + RLS, module
 * wiring, sync engine, and frontend registration — see `cella/ADD_ENTITY.md`.
 */
export const { accessPolicies, publicReadGrants, rowRestrictions, hostDelegation } = configurePermissions(
  appConfig.entityTypes,
  ({ subject, contexts, publicRead, delegateToHost }) => {
  switch (subject.name) {
    case 'organization':
      // self (this organization) — create is inert here: org creation is gated by tenant quota, not this policy
      contexts.organization.admin({ read: 1, update: 1, delete: 1 });
      contexts.organization.member({ read: 1, update: 0, delete: 0 });
      break;
    case 'workspace':
      // elevation (parent org) — create grants the right to make a workspace inside the org
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.organization.member({ create: 1, read: 1, update: 0, delete: 0 });
      // self (this workspace) — create omitted: you can't create a workspace from inside itself
      contexts.workspace.admin({ read: 1, update: 1, delete: 1 });
      contexts.workspace.member({ read: 1, update: 0, delete: 0 });
      break;
    case 'project':
      // Public read: a project becomes readable by anyone once its own publicAt is set
      publicRead('publicSelf');
      // elevation (parent org) — create grants the right to make a project inside the org
      contexts.organization.admin({ create: 1, read: 1, update: 1, delete: 1 });
      contexts.organization.member({ create: 1, read: 1, update: 0, delete: 0 });
      // self (this project) — create omitted: you can't create a project from inside itself
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
      // read: 'own' — org members may read/list attachments they created anywhere in the
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
