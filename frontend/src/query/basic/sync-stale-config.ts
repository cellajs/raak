/** StaleTime for sync-managed queries while the sync engine owns freshness. */
const syncTrustedStaleTime = Number.POSITIVE_INFINITY;

/** Fallback staleTime when the sync stream cannot be trusted (5 minutes). */
const syncFallbackStaleTime = 5 * 60 * 1000;

/**
 * Mirror stream health below the realtime layer so stale-time logic avoids a circular import.
 * The realtime store pushes state through `setSyncStreamHealthy`. Healthy means the stream is
 * not in a hard-error state: disconnected, connecting, catching-up, and live all count, because
 * catchup reconciles the cache on every (re)connect. Only a failing stream falls back to time,
 * so route-loader prefetches trust already-synced lists instead of refetching them on reload.
 * Starts trusted so the first prefetch after reload does not race the stream to `connecting`.
 */
let syncStreamHealthy = true;

// Cleared on a delivery shortfall (a promised seq that never arrived), restored on a clean
// catchup. AND-ed with stream health: either failure drops us to the fallback staleTime.
let syncDeliveryTrusted = true;

/** Called by the realtime stream store on every app-stream state transition. */
export const setSyncStreamHealthy = (healthy: boolean): void => {
  syncStreamHealthy = healthy;
};

export const setSyncDeliveryTrusted = (trusted: boolean): void => {
  syncDeliveryTrusted = trusted;
};
export const isSyncDeliveryTrusted = (): boolean => syncDeliveryTrusted;

/**
 * Dynamic staleTime for product entity queries covered by the catchup pipeline.
 * Infinity while the stream is healthy AND deliveries reconcile; else a 5 minute fallback.
 */
export const syncStaleTime = () =>
  syncStreamHealthy && syncDeliveryTrusted ? syncTrustedStaleTime : syncFallbackStaleTime;
