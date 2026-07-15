import type { DeepPartial } from '../src/config-builder/types';
import type { config as _default } from './config.default';

export const staging = {
  mode: 'staging',
  name: 'Raak STAGING',
  slug: 'raak-staging',

  domain: 'raak.dev',
  // Same-origin: every public service is a path under the staging app host.
  frontendUrl: 'https://staging.raak.dev',
  backendUrl: 'https://staging.raak.dev/api',
  backendAuthUrl: 'https://staging.raak.dev/api/auth',
  yjsUrl: 'wss://staging.raak.dev/yjs',
  mcpUrl: 'https://staging.raak.dev/mcp',
  // Keep the pre-flip staging API host alive as a 301 during the deprecation window.
  legacyUrls: { backend: 'https://api-staging.raak.dev' },
} satisfies DeepPartial<typeof _default>;
