import { describe, expect, it } from 'vitest';
import { appConfig } from '../config-builder/app-config';
import { configurePermissions } from './access-policies';
import { getAllDecisions } from './permission-manager/check';
import type { PermissionMembership, SubjectForPermission } from './permission-manager/types';
import type { HostDelegation } from './types';

/**
 * Host permission delegation (`delegateToHost`, raak: attachment → task): a hosted row
 * allows a delegated action if the HOST row allows it — including the host's row
 * conditions, public grants and restrictions. Additive with the subject's own grants;
 * fail-closed without a caller-resolved hostRow.
 *
 * Synthetic policies: attachments have NO own read grants (strict inheritance, the
 * projectcampus comment shape); tasks are readable by project members and updatable
 * by nobody but org admins.
 */

const { accessPolicies: policies } = configurePermissions(appConfig.entityTypes, ({ subject, contexts }) => {
  switch (subject.name) {
    case 'attachment':
      // No read cells at all — read must come from the host
      contexts.project.member({ update: 1 });
      contexts.organization.admin({});
      contexts.organization.member({});
      contexts.project.admin({});
      contexts.project.guest({});
      break;
    case 'task':
      contexts.organization.admin({ read: 1, update: 1 });
      contexts.organization.member({ read: 'own' });
      contexts.project.admin({ read: 1 });
      contexts.project.member({ read: 1 });
      contexts.project.guest({});
      break;
  }
});

const delegation: HostDelegation = { attachment: ['read'] };

const membership = (contextType: 'organization' | 'project', contextId: string, role: string): PermissionMembership =>
  ({ contextType, contextId, role }) as PermissionMembership;

const projectMember = membership('project', 'p1', 'member');
const projectGuest = membership('project', 'p1', 'guest');
const orgMember = membership('organization', 'org1', 'member');

const hostedAttachment = (hostRow: Record<string, unknown> | undefined): SubjectForPermission => ({
  entityType: 'attachment',
  id: 'att1',
  contextIds: { organization: 'org1', project: 'p1' },
  ...(hostRow !== undefined && { hostRow }),
});

const taskRow = { id: 'task1', createdBy: 'creator-1' };

describe('host delegation', () => {
  it('grants a delegated action when the host allows it, attributed as host grant', () => {
    const decision = getAllDecisions(policies, [projectMember], hostedAttachment(taskRow), {
      userId: 'u1',
      hostDelegation: delegation,
    });
    expect(decision.can.read).toBe(true);
    expect(decision.actions.read.grantedBy).toContainEqual({ type: 'host', hostType: 'task' });
  });

  it('denies when the host denies (no own grants to fall back on)', () => {
    const { can } = getAllDecisions(policies, [projectGuest], hostedAttachment(taskRow), {
      userId: 'u1',
      hostDelegation: delegation,
    });
    expect(can.read).toBe(false);
  });

  it("evaluates the host's row conditions: task creator reads the hosted attachment via own-on-host", () => {
    const asCreator = getAllDecisions(policies, [orgMember], hostedAttachment(taskRow), {
      userId: 'creator-1',
      hostDelegation: delegation,
    });
    expect(asCreator.can.read).toBe(true);

    const asOther = getAllDecisions(policies, [orgMember], hostedAttachment(taskRow), {
      userId: 'someone-else',
      hostDelegation: delegation,
    });
    expect(asOther.can.read).toBe(false);
  });

  it("evaluates the host's public grant: anonymous reads a hosted row of a public host", () => {
    const publicTask = { ...taskRow, publicAt: '2026-01-01' };
    const { can } = getAllDecisions(policies, [], hostedAttachment(publicTask), {
      hostDelegation: delegation,
      publicGrants: { task: 'publicSelf' },
    });
    expect(can.read).toBe(true);
  });

  it("evaluates the host's restrictions: a restricted host hides its hosted rows", () => {
    const restrictedTask = { ...taskRow, audienceRoles: ['admin'] };
    const { can } = getAllDecisions(policies, [projectMember], hostedAttachment(restrictedTask), {
      userId: 'u1',
      hostDelegation: delegation,
      restrictions: { task: { rolesColumn: 'audienceRoles', exemptRoles: [] } },
    });
    expect(can.read).toBe(false);
  });

  it('only delegates the declared actions', () => {
    // Task update is org-admin-only; attachment update is project-member-owned. Delegation
    // covers read only — update stays governed by the attachment's own cells.
    const decision = getAllDecisions(policies, [projectMember], hostedAttachment(taskRow), {
      userId: 'u1',
      hostDelegation: delegation,
    });
    expect(decision.can.update).toBe(true);
    expect(decision.actions.update.grantedBy).not.toContainEqual({ type: 'host', hostType: 'task' });
  });

  it('fail-closed: no hostRow resolved → delegation contributes nothing', () => {
    const { can } = getAllDecisions(policies, [projectMember], hostedAttachment(undefined), {
      userId: 'u1',
      hostDelegation: delegation,
    });
    expect(can.read).toBe(false);
  });

  it('unions with own grants instead of replacing them', () => {
    const { accessPolicies: withOwnRead } = configurePermissions(appConfig.entityTypes, ({ subject, contexts }) => {
      if (subject.name === 'attachment' || subject.name === 'task') {
        contexts.project.guest({ read: subject.name === 'attachment' ? 1 : 0 });
        contexts.project.member({ read: 1 });
        contexts.project.admin({ read: 1 });
        contexts.organization.admin({ read: 1 });
        contexts.organization.member({});
      }
    });
    // Guest has own read on attachments but no task read: own grant must survive delegation
    const { can } = getAllDecisions(withOwnRead, [projectGuest], hostedAttachment(taskRow), {
      userId: 'u1',
      hostDelegation: delegation,
    });
    expect(can.read).toBe(true);
  });
});

describe('delegateToHost declaration', () => {
  it('collects delegated actions in the config result', () => {
    const { hostDelegation } = configurePermissions(appConfig.entityTypes, ({ subject, delegateToHost }) => {
      if (subject.name === 'attachment') delegateToHost(['read']);
    });
    expect(hostDelegation).toEqual({ attachment: ['read'] });
  });

  it('throws for subjects without a hierarchy host', () => {
    expect(() =>
      configurePermissions(appConfig.entityTypes, ({ subject, delegateToHost }) => {
        if (subject.name === 'task') delegateToHost(['read']);
      }),
    ).toThrow('requires a host declared in the hierarchy');
  });

  it('throws on empty actions and double declaration', () => {
    expect(() =>
      configurePermissions(appConfig.entityTypes, ({ subject, delegateToHost }) => {
        if (subject.name === 'attachment') delegateToHost([]);
      }),
    ).toThrow('at least one action');

    expect(() =>
      configurePermissions(appConfig.entityTypes, ({ subject, delegateToHost }) => {
        if (subject.name === 'attachment') {
          delegateToHost(['read']);
          delegateToHost(['update']);
        }
      }),
    ).toThrow('called twice');
  });
});
