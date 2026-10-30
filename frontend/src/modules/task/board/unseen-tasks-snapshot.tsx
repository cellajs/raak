import { useLayoutEffect } from 'react';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { isSeenLocally, seenStore } from '~/modules/seen/seen-store';
import { useUnseenTasksStore } from '~/modules/task/board/unseen-tasks-store';
import { unseenTaskIdsQueryOptions } from '~/modules/task/query';
import { queryClient } from '~/query/query-client';
import { onSyncedRows } from '~/query/realtime/sync-events';

/** A tab hidden this long takes a new snapshot on return, or a board left open for days keeps marking what was seen since. */
const refreshAfterHiddenMs = 30 * 60 * 1000;

let flushInProgress: Promise<void> | null = null;

/** A flush with an empty queue returns at once, so a second caller (StrictMode's second mount) must wait for the request already out. */
const flushSeenMarks = () => {
  flushInProgress ??= seenStore
    .getState()
    .flush()
    .finally(() => {
      flushInProgress = null;
    });
  return flushInProgress;
};

/** Fills `useUnseenTasksStore` for one board visit: a snapshot on mount, then the tasks created while it lasts. Renders nothing. */
export function UnseenTasksSnapshot() {
  const { organizationId, tenantId } = useOrganizationLayoutContext();

  // Before paint: cached cards mount in this commit, and a `SeenMark` firing first would send them in the flush below as already seen.
  useLayoutEffect(() => {
    const { replace, add, clear } = useUnseenTasksStore.getState();
    let active = true;
    let snapshotAt = 0;
    let hiddenAt: number | null = null;

    const takeSnapshot = async () => {
      snapshotAt = Date.now();
      try {
        // First, so what an earlier visit queued but never sent does not come back as unseen.
        await flushSeenMarks();
        const { items } = await queryClient.fetchQuery(unseenTaskIdsQueryOptions(organizationId, tenantId));
        if (active) replace(items);
      } catch {
        // Offline or failed: the board just shows no marks.
      }
    };

    const unsubscribeRows = onSyncedRows(({ entityType, organizationId: rowsOrganizationId, rows }) => {
      if (entityType !== 'task' || rowsOrganizationId !== organizationId) return;
      const arrived = rows.filter(({ id, createdAt, deletedAt }) => {
        if (typeof createdAt !== 'string' || deletedAt) return false;
        return Date.parse(createdAt) > snapshotAt && !isSeenLocally(id);
      });
      if (arrived.length) add(arrived.map(({ id }) => id));
    });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt !== null && Date.now() - hiddenAt > refreshAfterHiddenMs) void takeSnapshot();
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    void takeSnapshot();

    return () => {
      active = false;
      unsubscribeRows();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clear();
    };
  }, [organizationId, tenantId]);

  return null;
}
