import development from './config.development';
import type { DeepPartial } from '../src/config-builder/types';
import type _default from './config.default';

export default {
  mode: 'test',
  name: 'Raak TEST',
  domain: '',
  frontendUrl: development.frontendUrl,
  backendUrl: development.backendUrl,
  backendAuthUrl: development.backendAuthUrl,
} satisfies DeepPartial<typeof _default>;
