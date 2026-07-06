import type { DeepPartial } from '../src/config-builder/types';
import type { config as _default } from './config.default';

export const staging = {
  mode: 'staging',
  name: 'Raak STAGING',
  slug: 'raak-staging',

  domain: 'raak.dev',
  frontendUrl: 'https://staging.raak.dev',
  backendUrl: 'https://api-staging.raak.dev',
  backendAuthUrl: 'https://api-staging.raak.dev/auth',
} satisfies DeepPartial<typeof _default>;
