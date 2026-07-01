import type { DeepPartial } from '../src/config-builder/types';
import type _default from './config.default';

export default {
  mode: 'tunnel',
  name: 'Raak TUNNEL',
  frontendUrl: 'https://localhost:3010',
  backendUrl: 'https://raak.ngrok.dev',
  backendAuthUrl: 'https://raak.ngrok.dev/auth',
} satisfies DeepPartial<typeof _default>;
