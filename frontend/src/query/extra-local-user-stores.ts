import { useLabelRecencyStore } from '~/modules/label/label-recency-store';
import { useTaskBoardStore } from '~/modules/task/board/task-board-store';
import type { LocalUserStore } from '~/query/local-user-storage';

/**
 * Extra per-user zustand stores this app adds, appended to the master list in `local-user-storage`.
 *
 * raak persists a task-board store and a label-recency store in `localUserDb.kv` so
 * `localUserStorageReady` rehydrates them for the signed-in user and sign-out resets them. Each store
 * must expose `persist.rehydrate()` and a `getState().reset()`.
 */
export const extraLocalUserStores: LocalUserStore[] = [useTaskBoardStore, useLabelRecencyStore];
