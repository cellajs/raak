import { baseDb } from '#/db/db';
import type { DemoModel } from '#/modules/demo/demo-db';
import { findExpiredDemos } from '#/modules/demo/demo-queries';
import { removeDemo } from '#/modules/demo/operations/remove-demo';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

const dbCtx = { var: { db: baseDb } };

/**
 * Removes the demos whose time is over, each on its own so one failure leaves the rest removed.
 * @throws After every demo ran, when any failed, so the jobs worker records a failed run.
 */
export async function expireDemos() {
  const expired: DemoModel[] = await findExpiredDemos(dbCtx, { now: getIsoDate() });
  let failed = 0;
  for (const demo of expired) {
    try {
      await removeDemo(demo);
    } catch (err) {
      failed += 1;
      log.error('Removing an expired demo failed', { demoId: demo.id, err });
    }
  }
  if (expired.length) log.info('Expired demos removed', { count: expired.length - failed, failed });
  if (failed > 0) throw new Error(`Removing expired demos failed for ${failed} of ${expired.length}`);
}
