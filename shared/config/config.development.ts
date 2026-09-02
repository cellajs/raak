import type { DeepPartial } from '../src/config-builder/types.ts';
import type { config as _default } from './config.default.ts';

export const development = {
  mode: 'development',
  name: 'Raak DEVELOPMENT',
  slug: 'raak-development',

  has: {
    selfRegistration: true,
    waitlist: true,
    chatSupport: false,
  },

  domain: '',
  // Same-origin in development too: the Vite dev server proxies /api, /yjs and /mcp
  // to the service ports (vite.config.ts), so cookies and CSP behave like production.
  // Services listen on `devPorts`; apps offset that block and these URL ports together.
  frontendUrl: 'http://localhost:3000',
  backendUrl: 'http://localhost:3000/api',
  backendAuthUrl: 'http://localhost:3000/api/auth',
  yjsUrl: 'ws://localhost:3000/yjs',
  mcpUrl: 'http://localhost:3000/mcp',

  s3: {
    publicBucket: 'cella-shared-public',
    privateBucket: 'cella-shared-private',
  },
} satisfies DeepPartial<typeof _default>;
