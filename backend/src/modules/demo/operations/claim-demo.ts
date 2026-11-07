import type { Context } from 'hono';
import type { Env } from '#/core/context';
import { AppError } from '#/core/error';
import { baseDb } from '#/db/db';
import { setUserSession } from '#/modules/auth/sessions/operations/create-session';
import { findSession } from '#/modules/auth/sessions/operations/resolve-session';
import { dailyDemoClaims } from '#/modules/demo/demo-constants';
import { countClaimsSince, findDemoByUser } from '#/modules/demo/demo-queries';
import { buildDemo } from '#/modules/demo/operations/build-demo';
import { demoEntryAnswer } from '#/modules/demo/operations/demo-place';
import { isoDateAgo } from '#/utils/iso-date';
import { log } from '#/utils/logger';
import { TimeSpan } from '#/utils/time-span';

const dbCtx = { var: { db: baseDb } };

/**
 * Gives this browser a demo and signs it in to the demo's account: the demo its session holds, else one built
 * now. The visitor asks for it by pressing the about page's board.
 * @returns Where it opens, when it ends, its share code, the sample projects its board first opens folded, and
 * `claimed` when this request took it.
 * @throws AppError 409 `demo_signed_in` while an account that is no demo is signed in here; 503
 * `demo_unavailable` once the day's claims are spent.
 */
export async function claimDemoOp(ctx: Context<Env>) {
  const current = await findSession(ctx);
  if (current) {
    const own = await findDemoByUser(dbCtx, { userId: current.user.id });
    if (own) return demoEntryAnswer(own, current.user.id, false);
    throw new AppError(409, 'demo_signed_in', 'info');
  }

  const claimsToday = await countClaimsSince(dbCtx, { since: isoDateAgo(new TimeSpan(1, 'd')) });
  if (claimsToday >= dailyDemoClaims) throw new AppError(503, 'demo_unavailable', 'warn');

  const { demo, user } = await buildDemo();
  await setUserSession(ctx, user, 'demo');
  log.info('Demo claimed', { demoId: demo.id });

  return demoEntryAnswer(demo, user.id, true);
}
