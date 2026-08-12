import type { DeepPartial } from '../src/config-builder/types.ts';
import type { config as _default } from './config.default.ts';

export const tunnel = {
  mode: 'tunnel',
  name: 'Raak TUNNEL',
  slug: 'raak-tunnel',

  frontendUrl: 'https://localhost:3000',
  backendUrl: 'https://raak.ngrok.dev',
  backendAuthUrl: 'https://raak.ngrok.dev/auth',
} satisfies DeepPartial<typeof _default>;
