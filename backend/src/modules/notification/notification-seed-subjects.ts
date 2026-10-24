import type { ProductEntityType } from 'shared';

// fork: raak's seeded inbox demonstrates task mentions
/**
 * Products the notifications seed mentions the admin in (app-owned): the newest rows homed in channels the admin
 * belongs to, each mentioned by another member of that channel. An empty list seeds no inbox.
 */
export const seedMentionEntityTypes: ProductEntityType[] = ['task'];
