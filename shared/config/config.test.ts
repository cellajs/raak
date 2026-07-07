import type { DeepPartial } from '../src/config-builder/types';
import type { config as _default } from './config.default';
import { development } from './config.development';

/** Test environment overrides. Must run on localhost; keep minimal and free of any secrets. */
export const test = {
  mode: 'test',
  name: 'Raak TEST',

  domain: '',

  services: {
    mcp: { enabled: false },
  },

  frontendUrl: development.frontendUrl,
  backendUrl: development.backendUrl,
  backendAuthUrl: development.backendAuthUrl,
  yjsUrl: development.yjsUrl,
  mcpUrl: development.mcpUrl,
} satisfies DeepPartial<typeof _default>;
