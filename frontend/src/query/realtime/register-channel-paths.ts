import { findInCache } from '~/query/basic/find-in-list-cache';
import { registerChannelPathResolver } from '~/query/realtime/view-declaration';

// Cached channel paths narrow synchronization views to project or workspace boundaries.
// Missing rows return null so the engine retains the organization-wide view.
const CHANNEL_TYPES = ['project', 'workspace'] as const;

registerChannelPathResolver((channelType, channelId) => {
  const types = channelType ? [channelType] : CHANNEL_TYPES;
  for (const type of types) {
    const row = findInCache<{ id: string; path?: string | null }>(type, channelId);
    if (row?.path) return row.path;
  }
  return null;
});
