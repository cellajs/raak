import { findInCache } from '~/query/basic/find-in-list-cache';
import { registerChannelPathResolver } from '~/query/realtime/view-declaration';

/**
 * Fork channel-path resolver: lets the sync engine derive grant-boundary views and narrow
 * covering delta-fetches by the covering channel id for raak's sub-org channels (`project`, `workspace`,
 * both direct children of `organization`).
 *
 * The server-computed `path` (e.g. `"<orgId>/<projectId>"`) rides on every cached channel row,
 * so we read it straight off the query cache. `channelType` is null when the scheduler knows
 * only the id (covering-prefix computation) → search both channel types. An unresolved path
 * (row not cached) returns null, and the engine falls back to the org-wide view — i.e. this is
 * purely additive precision, never a correctness dependency.
 */
const CHANNEL_TYPES = ['project', 'workspace'] as const;

registerChannelPathResolver((channelType, channelId) => {
  const types = channelType ? [channelType] : CHANNEL_TYPES;
  for (const type of types) {
    const row = findInCache<{ id: string; path?: string | null }>(type, channelId);
    if (row?.path) return row.path;
  }
  return null;
});
