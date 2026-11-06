import type { Context } from 'hono';
import type { Env } from '#/core/context';
import { AppError } from '#/core/error';
import { baseDb } from '#/db/db';
import { setUserSession } from '#/modules/auth/sessions/operations/create-session';
import { findSession } from '#/modules/auth/sessions/operations/resolve-session';
import { buildSandbox } from '#/modules/sandbox/operations/build-sandbox';
import { sandboxAnswer } from '#/modules/sandbox/operations/sandbox-place';
import { dailySandboxClaims, sandboxContentVersion, sandboxLifetime } from '#/modules/sandbox/sandbox-constants';
import { claimReadySandbox, claimSandbox, countClaimsSince, findSandboxByUser } from '#/modules/sandbox/sandbox-queries';
import { findUserById } from '#/modules/user/user-queries';
import { getIsoDate, isoDateAgo, isoDateIn } from '#/utils/iso-date';
import { log } from '#/utils/logger';
import { TimeSpan } from '#/utils/time-span';

const dbCtx = { var: { db: baseDb } };

/**
 * Gives this browser a sandbox and signs it in to the sandbox's account: the sandbox its session holds, else a ready one
 * from the pool, else one built now. The visitor asks for it by acting on the about page's board.
 * @returns Where it opens, when it ends, and `claimed` when this request took it.
 * @throws AppError 409 `sandbox_signed_in` while an account that is no sandbox is signed in here; 503
 * `sandbox_unavailable` once the day's claims are spent.
 */
export async function claimSandboxOp(ctx: Context<Env>) {
  const current = await findSession(ctx);
  if (current) {
    const own = await findSandboxByUser(dbCtx, { userId: current.user.id });
    if (own?.status === 'claimed') return { ...(await sandboxAnswer(own)), claimed: false };
    throw new AppError(409, 'sandbox_signed_in', 'info');
  }

  const claimsToday = await countClaimsSince(dbCtx, { since: isoDateAgo(new TimeSpan(1, 'd')) });
  if (claimsToday >= dailySandboxClaims) throw new AppError(503, 'sandbox_unavailable', 'warn');

  const claim = { contentVersion: sandboxContentVersion, claimedAt: getIsoDate(), expiresAt: isoDateIn(sandboxLifetime) };
  const pooled = await claimReadySandbox(dbCtx, claim);
  const sandbox = pooled ?? (await claimSandbox(dbCtx, { ...claim, id: (await buildSandbox()).id }));
  if (!sandbox) throw new AppError(503, 'sandbox_unavailable', 'warn');

  const user = await findUserById(dbCtx, { id: sandbox.userId });
  if (!user) throw new AppError(503, 'sandbox_unavailable', 'warn', { meta: { sandboxId: sandbox.id } });
  await setUserSession(ctx, user, 'sandbox');
  log.info('Sandbox claimed', { sandboxId: sandbox.id, fromPool: !!pooled });

  return { ...(await sandboxAnswer(sandbox)), claimed: true };
}
