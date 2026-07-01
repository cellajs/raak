import type { DeepPartial } from '../src/config-builder/types';
import type _default from './config.default';

export default {
  mode: 'development',
  name: 'Raak DEVELOPMENT',
  slug: 'raak-development',
  domain: '',
  frontendUrl: 'http://localhost:3010',
  backendUrl: 'http://localhost:4010',
  backendAuthUrl: 'http://localhost:4010/auth',
} satisfies DeepPartial<typeof _default>;
