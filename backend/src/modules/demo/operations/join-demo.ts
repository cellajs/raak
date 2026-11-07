import type { Context } from 'hono';
import { generateId } from 'shared/utils/entity-id';
import { nanoid } from 'shared/utils/nanoid';
import type { Env } from '#/core/context';
import { AppError } from '#/core/error';
import { baseDb } from '#/db/db';
import { setUserSession } from '#/modules/auth/sessions/operations/create-session';
import { findSession } from '#/modules/auth/sessions/operations/resolve-session';
import { demoPeopleCap } from '#/modules/demo/demo-constants';
import type { DemoModel } from '#/modules/demo/demo-db';
import { addDemoGuest, findDemoByShareCode, findOrganizationProjects, removeDemoGuest } from '#/modules/demo/demo-queries';
import { insertDemoAccount } from '#/modules/demo/operations/demo-account';
import { demoEntryAnswer } from '#/modules/demo/operations/demo-place';
import { insertMemberships } from '#/modules/memberships/operations/insert-memberships';
import { findOrganizationByTenant } from '#/modules/organization/organization-queries';
import { deleteAccounts } from '#/modules/user/operations/delete-accounts';
import type { UserModel } from '#/modules/user/user-db';
import { findUserModelsByIds } from '#/modules/user/user-queries';
import { ensureUserWorkspace } from '#/modules/workspace/operations/ensure-workspace';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

const dbCtx = { var: { db: baseDb } };

const peopleOf = (demo: DemoModel) => [demo.userId, ...demo.guestIds];

/** @throws AppError 404 `demo_ended` for a code no running demo holds. */
const runningDemo = async (shareCode: string) => {
  const demo = await findDemoByShareCode(dbCtx, { shareCode });
  if (!demo || demo.expiresAt < getIsoDate()) throw new AppError(404, 'demo_ended', 'info');
  return demo;
};

/** Gives a guest what the demo's taker has: its organization and every project in it, under a workspace of their own. */
const seatGuest = async (demo: DemoModel, user: UserModel) => {
  const organization = await findOrganizationByTenant(dbCtx, { tenantId: demo.tenantId });
  if (!organization) throw new AppError(404, 'demo_ended', 'warn', { meta: { demoId: demo.id } });
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
 * The demo a share link leads to: the first names of the people in it, when it ends, whether it is full, and
 * whether this browser is in it already.
 * @throws AppError 404 `demo_ended` once it is gone.
 */
export async function getDemoInviteOp(ctx: Context<Env>, { shareCode }: { shareCode: string }) {
  const demo = await runningDemo(shareCode);
  const [current, people] = await Promise.all([findSession(ctx), findUserModelsByIds(dbCtx, { ids: peopleOf(demo) })]);
  const names = peopleOf(demo).flatMap((id) => people.find((person) => person.id === id)?.firstName ?? []);
  return {
    people: names,
    expiresAt: demo.expiresAt,
    full: peopleOf(demo).length >= demoPeopleCap,
    joined: !!current && peopleOf(demo).includes(current.user.id),
  };
}

/**
 * Lets this browser into the demo of a share link: a demo account of its own under `firstName`, signed in, in
 * the demo's organization and projects. A browser in it already gets it back.
 * @returns Where it opens, as a claim answers, with `claimed` when this request let the browser in.
 * @throws AppError 404 `demo_ended` once it is gone; 409 `demo_full` at {@link demoPeopleCap} people;
 * 409 `demo_signed_in` while another account is signed in here.
 */
export async function joinDemoOp(ctx: Context<Env>, { shareCode, firstName }: { shareCode: string; firstName: string }) {
  const demo = await runningDemo(shareCode);
  const current = await findSession(ctx);
  if (current) {
    if (peopleOf(demo).includes(current.user.id)) return demoEntryAnswer(demo, current.user.id, false);
    throw new AppError(409, 'demo_signed_in', 'info');
  }

  const userId = generateId();
  const seated = await addDemoGuest(dbCtx, { id: demo.id, userId, cap: demoPeopleCap });
  if (!seated) throw new AppError(409, 'demo_full', 'info');

  let user: UserModel | undefined;
  try {
    user = await insertDemoAccount({ id: userId, handle: nanoid(10), firstName });
    await seatGuest(seated, user);
  } catch (error) {
    await removeDemoGuest(dbCtx, { id: demo.id, userId });
    if (user) await deleteAccounts(dbCtx, { userIds: [userId], by: userId });
    throw error;
  }

  await setUserSession(ctx, user, 'demo');
  log.info('Demo joined', { demoId: demo.id, people: peopleOf(seated).length });
  return demoEntryAnswer(seated, userId, true);
}
