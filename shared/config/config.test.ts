import type { DeepPartial } from '../src/config-builder/types.ts';
import type { config as _default } from './config.default.ts';
import { development } from './config.development.ts';

/** Test environment overrides. Must run on localhost; keep minimal and free of any secrets. */
export const test = {
  mode: 'test',
  name: 'Raak TEST',

  domain: '',

  services: {
    mcp: { enabled: true },
    oauth: { enabled: true },
  },

  frontendUrl: development.frontendUrl,
  backendUrl: development.backendUrl,
  backendAuthUrl: development.backendAuthUrl,
  yjsUrl: development.yjsUrl,
  mcpUrl: development.mcpUrl,
  oauthUrl: development.oauthUrl,
} satisfies DeepPartial<typeof _default>;
