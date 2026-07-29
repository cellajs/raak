import { useLabelRecencyStore } from '~/modules/label/label-recency-store';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import type { AppKvStore } from '~/query/app-storage';

/**
 * Fork-owned per-user zustand stores, appended to the app's kv-store list in `app-storage`.
 *
 * raak persists a board store and a label-recency store in `appdb.kv` so `appStorageReady`
 * rehydrates them for the signed-in user and sign-out resets them. Each store exposes
 * `persist.rehydrate()` and a `getState().reset()`.
 */
export const forkAppKvStores: AppKvStore[] = [useTaskBoardStore, useLabelRecencyStore];
