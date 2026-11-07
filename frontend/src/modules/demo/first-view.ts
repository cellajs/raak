import { boardStore } from '~/modules/common/board/board-store';
import { meQueryOptions } from '~/modules/me/query';
import { flushKvWrites } from '~/query/idb-kv-storage';
import { localUserStorageReady } from '~/query/local-user-storage';
import { queryClient } from '~/query/query-client';

/**
 * Folds Getting started and the sample's folded projects on a new demo's board, on this device, before its frame or
 * page boots: those read the store from disk. Call it once the demo's account is the stored user.
 */
async function foldDemoFirstView(projectIds: string[]) {
  // Lazy: the about page holds this module, and the panel's module brings the board along
  const [{ EXPLAINER_PANEL_ID }] = await Promise.all([import('~/modules/common/board/explainer-panel'), localUserStorageReady()]);
  const { setPanelCollapsed } = boardStore.getState();
  for (const panelId of [EXPLAINER_PANEL_ID, ...projectIds]) setPanelCollapsed(panelId, true);
  flushKvWrites();
}

/**
 * Readies this browser for the demo it just took or joined: the account becomes the stored user, so the app opens
 * without a sign-in round, and a board new here opens with its first view folded.
 */
export async function enterDemo({ claimed, foldedProjectIds }: { claimed: boolean; foldedProjectIds: string[] }) {
  await queryClient.fetchQuery(meQueryOptions());
  if (claimed) await foldDemoFirstView(foldedProjectIds);
}
