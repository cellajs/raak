import type { DeepPartial } from '../src/config-builder/types';
import type { config as _default } from './config.default';

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
  frontendUrl: 'http://localhost:3000',
  backendUrl: 'http://localhost:3000/api',
  backendAuthUrl: 'http://localhost:3000/api/auth',
  yjsUrl: 'http://localhost:3000/yjs',
  mcpUrl: 'http://localhost:3000/mcp',

  s3: {
    publicBucket: 'cella-shared-public',
    privateBucket: 'cella-shared-private',
  },
  
} satisfies DeepPartial<typeof _default>;
