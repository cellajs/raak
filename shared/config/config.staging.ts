import type { DeepPartial } from '../src/config-builder/types';
import type _default from './config.default';

export default {
  mode: 'staging',
  name: 'Raak STAGING',
  slug: 'raak-staging',
  domain: 'raak.example.com',
  frontendUrl: 'https://staging.raak.example.com',
  backendUrl: 'https://api-staging.raak.example.com',
  backendAuthUrl: 'https://api-staging.raak.example.com/auth',
} satisfies DeepPartial<typeof _default>;
