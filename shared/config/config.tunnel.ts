import type { DeepPartial } from '../src/config-builder/types.ts';
import type { config as _default } from './config.default.ts';

export const tunnel = {
  mode: 'tunnel',
  name: 'Raak TUNNEL',
  slug: 'raak-tunnel',

  // The tunnel fronts the Vite dev server, which proxies /api, /yjs and /mcp to the service
  // ports. One public origin keeps cookies first-party, so no SameSite=None is needed.
  frontendUrl: 'https://raak.ngrok.dev',
  backendUrl: 'https://raak.ngrok.dev/api',
  backendAuthUrl: 'https://raak.ngrok.dev/api/auth',
  yjsUrl: 'wss://raak.ngrok.dev/yjs',
  mcpUrl: 'https://raak.ngrok.dev/mcp',
} satisfies DeepPartial<typeof _default>;
