import { baseDb } from '#/db/db';
import { buildSandbox } from '#/modules/sandbox/operations/build-sandbox';
import { removeSandbox } from '#/modules/sandbox/operations/remove-sandbox';
import { readySandboxMaxAge, sandboxContentVersion, sandboxPoolSize } from '#/modules/sandbox/sandbox-constants';
import type { SandboxModel } from '#/modules/sandbox/sandbox-db';
import { countReadySandboxes, findExpiredSandboxes, findStaleReadySandboxes } from '#/modules/sandbox/sandbox-queries';
import { getIsoDate, isoDateAgo } from '#/utils/iso-date';
import { log } from '#/utils/logger';

const dbCtx = { var: { db: baseDb } };

/**
 * Removes each sandbox, logging a failure and trying the next.
 * @throws After every sandbox ran, when any failed, so the jobs worker records a failed run.
 */
const removeEach = async (sandboxes: SandboxModel[], reason: string) => {
  let failed = 0;
  for (const sandbox of sandboxes) {
    try {
      await removeSandbox(sandbox);
    } catch (err) {
      failed += 1;
      log.error('Removing a sandbox failed', { sandboxId: sandbox.id, reason, err });
    }
  }
  if (failed > 0) throw new Error(`Removing ${reason} sandboxes failed for ${failed} of ${sandboxes.length}`);
};

/** Rebuilds ready sandboxes of an older dataset or past their age, then builds until `size` are ready. */
export async function refillSandboxPool(size = sandboxPoolSize) {
  const stale = await findStaleReadySandboxes(dbCtx, { contentVersion: sandboxContentVersion, createdBefore: isoDateAgo(readySandboxMaxAge) });
  await removeEach(stale, 'stale');

  const ready = await countReadySandboxes(dbCtx, { contentVersion: sandboxContentVersion });
  for (let count = ready; count < size; count++) await buildSandbox();
  if (stale.length || ready < size) log.info('Sandbox pool refilled', { removed: stale.length, built: Math.max(0, size - ready) });
}

/** Removes the claimed sandboxes whose week is over. */
export async function expireSandboxes() {
  const expired = await findExpiredSandboxes(dbCtx, { now: getIsoDate() });
  await removeEach(expired, 'expired');
  if (expired.length) log.info('Expired sandboxes removed', { count: expired.length });
}
