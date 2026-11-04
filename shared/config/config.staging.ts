import type { DeepPartial } from '../src/config-builder/types.ts';
import { config } from './config.default.ts';

export const staging = {
  name: `${config.name} STAGING`,
  slug: `${config.slug}-staging`,

  origin: `https://staging.${config.domain}`,
} satisfies DeepPartial<typeof config>;
