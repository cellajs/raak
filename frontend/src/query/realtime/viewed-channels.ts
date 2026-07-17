/**
 * Channel ids currently rendered on screen, registered by the view that renders them.
 *
 * The lazy sync scheduler picks a scope's tier from the route (`isViewingScope` in
 * `sync-priority.ts`), which can only see channels the route itself names. The workspace board
 * renders a panel per project in the workspace, so those project channels are on screen while only
 * the workspace appears in the route — without this registry every task on the open board syncs on
 * the 2–30s background tier instead of live.
 *
 * Plain module state rather than a store: `getSyncTier` reads it imperatively per notification and
 * nothing re-renders when it changes.
 */
let viewedChannelIds: ReadonlySet<string> = new Set();

/** Replace the on-screen channel set. Call from a view's effect; pass the channels it renders. */
export function setViewedChannels(ids: Iterable<string>): void {
  viewedChannelIds = new Set(ids);
}

/** Drop the on-screen channel set. Call from the registering view's effect cleanup. */
export function clearViewedChannels(): void {
  viewedChannelIds = new Set();
}

export function isViewedChannel(channelId: string): boolean {
  return viewedChannelIds.has(channelId);
}
