import type { Context } from 'hono';
import { generateId } from 'shared/utils/entity-id';
import { nanoid } from 'shared/utils/nanoid';
import type { Env } from '#/core/context';
import { AppError } from '#/core/error';
import { baseDb } from '#/db/db';
import { setUserSession } from '#/modules/auth/sessions/operations/create-session';
import { findSession } from '#/modules/auth/sessions/operations/resolve-session';
import { insertMemberships } from '#/modules/memberships/operations/insert-memberships';
import { findOrganizationByTenant } from '#/modules/organization/organization-queries';
import { insertSandboxAccount } from '#/modules/sandbox/operations/sandbox-account';
import { sandboxEntryAnswer } from '#/modules/sandbox/operations/sandbox-place';
import { sandboxPeopleCap } from '#/modules/sandbox/sandbox-constants';
import type { SandboxModel } from '#/modules/sandbox/sandbox-db';
import { addSandboxGuest, findClaimedSandboxByShareCode, findOrganizationProjects, removeSandboxGuest } from '#/modules/sandbox/sandbox-queries';
import { deleteAccounts } from '#/modules/user/operations/delete-accounts';
import type { UserModel } from '#/modules/user/user-db';
import { findUserModelsByIds } from '#/modules/user/user-queries';
import { ensureUserWorkspace } from '#/modules/workspace/operations/ensure-workspace';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

const dbCtx = { var: { db: baseDb } };

const peopleOf = (sandbox: SandboxModel) => [sandbox.userId, ...sandbox.guestIds];

/** @throws AppError 404 `sandbox_ended` for a code no running sandbox holds. */
const runningSandbox = async (shareCode: string) => {
  const sandbox = await findClaimedSandboxByShareCode(dbCtx, { shareCode });
  if (!sandbox || (sandbox.expiresAt && sandbox.expiresAt < getIsoDate())) throw new AppError(404, 'sandbox_ended', 'info');
  return sandbox;
};

/** Gives a guest what the sandbox's taker has: its organization and every project in it, under a workspace of their own. */
const seatGuest = async (sandbox: SandboxModel, user: UserModel) => {
  const organization = await findOrganizationByTenant(dbCtx, { tenantId: sandbox.tenantId });
  if (!organization) throw new AppError(404, 'sandbox_ended', 'warn', { meta: { sandboxId: sandbox.id } });
  await insertMemberships(dbCtx, { items: [{ userId: user.id, createdBy: user.id, role: 'member', entity: organization }] });
  const workspaceId = await ensureUserWorkspace(dbCtx, { userId: user.id, organizationId: organization.id });
  const projects = await findOrganizationProjects(dbCtx, { organizationId: organization.id });
  await insertMemberships(dbCtx, {
    items: projects.map((project) => ({
      userId: user.id,
      createdBy: user.id,
      role: 'member' as const,
      entity: project,
      extraFields: { workspaceId },
    })),
  });
};

/**
 * The sandbox a share link leads to: the first names of the people in it, when it ends, whether it is full, and
 * whether this browser is in it already.
 * @throws AppError 404 `sandbox_ended` once it is gone.
 */
export async function getSandboxInviteOp(ctx: Context<Env>, { shareCode }: { shareCode: string }) {
  const sandbox = await runningSandbox(shareCode);
  const [current, people] = await Promise.all([findSession(ctx), findUserModelsByIds(dbCtx, { ids: peopleOf(sandbox) })]);
  const names = peopleOf(sandbox).flatMap((id) => people.find((person) => person.id === id)?.firstName ?? []);
  return {
    people: names,
    expiresAt: sandbox.expiresAt,
    full: peopleOf(sandbox).length >= sandboxPeopleCap,
    joined: !!current && peopleOf(sandbox).includes(current.user.id),
  };
}

/**
 * Lets this browser into the sandbox of a share link: a sandbox account of its own under `firstName`, signed in, in
 * the sandbox's organization and projects. A browser in it already gets it back.
 * @returns Where it opens, as a claim answers, with `claimed` when this request let the browser in.
 * @throws AppError 404 `sandbox_ended` once it is gone; 409 `sandbox_full` at {@link sandboxPeopleCap} people;
 * 409 `sandbox_signed_in` while another account is signed in here.
 */
export async function joinSandboxOp(ctx: Context<Env>, { shareCode, firstName }: { shareCode: string; firstName: string }) {
  const sandbox = await runningSandbox(shareCode);
  const current = await findSession(ctx);
  if (current) {
    if (peopleOf(sandbox).includes(current.user.id)) return sandboxEntryAnswer(sandbox, current.user.id, false);
    throw new AppError(409, 'sandbox_signed_in', 'info');
  }

  const userId = generateId();
  const seated = await addSandboxGuest(dbCtx, { id: sandbox.id, userId, cap: sandboxPeopleCap });
  if (!seated) throw new AppError(409, 'sandbox_full', 'info');

  let user: UserModel | undefined;
  try {
    user = await insertSandboxAccount({ id: userId, handle: nanoid(10), firstName });
    await seatGuest(seated, user);
  } catch (error) {
    await removeSandboxGuest(dbCtx, { id: sandbox.id, userId });
    if (user) await deleteAccounts(dbCtx, { userIds: [userId], by: userId });
    throw error;
  }

  await setUserSession(ctx, user, 'sandbox');
  log.info('Sandbox joined', { sandboxId: sandbox.id, people: peopleOf(seated).length });
  return sandboxEntryAnswer(seated, userId, true);
}
