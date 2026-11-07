import { baseDb } from '#/db/db';
import { removeSandbox } from '#/modules/sandbox/operations/remove-sandbox';
import type { SandboxModel } from '#/modules/sandbox/sandbox-db';
import { findExpiredSandboxes } from '#/modules/sandbox/sandbox-queries';
import { getIsoDate } from '#/utils/iso-date';
import { log } from '#/utils/logger';

const dbCtx = { var: { db: baseDb } };

/**
 * Removes the sandboxes whose time is over, each on its own so one failure leaves the rest removed.
 * @throws After every sandbox ran, when any failed, so the jobs worker records a failed run.
 */
export async function expireSandboxes() {
  const expired: SandboxModel[] = await findExpiredSandboxes(dbCtx, { now: getIsoDate() });
  let failed = 0;
  for (const sandbox of expired) {
    try {
      await removeSandbox(sandbox);
    } catch (err) {
      failed += 1;
      log.error('Removing an expired sandbox failed', { sandboxId: sandbox.id, err });
    }
  }
  if (expired.length) log.info('Expired sandboxes removed', { count: expired.length - failed, failed });
  if (failed > 0) throw new Error(`Removing expired sandboxes failed for ${failed} of ${expired.length}`);
}
