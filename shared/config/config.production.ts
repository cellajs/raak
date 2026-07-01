import type { DeepPartial } from '../src/config-builder/types';
import type _default from './config.default';

export default {
  mode: 'production',
  maintenance: false,
} satisfies DeepPartial<typeof _default>;
