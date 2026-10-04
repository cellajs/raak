import { type LucideIcon, SquareCheckBigIcon } from 'lucide-react';
import type { ChannelEntityType, ProductEntityType } from 'shared';

/**
 * App configuration for the per-member insight columns in the members table. Which product stats
 * exist comes from `appConfig.memberStatProductTypes`; this file decides how they look.
 */
export const memberStatIcons: Partial<Record<ProductEntityType, LucideIcon>> = { task: SquareCheckBigIcon };

/**
 * Count columns (`${type}Count`, product and sub-channel types alike) hidden by default. Users can
 * still toggle them on via the columns view.
 */
export const hiddenMemberCountColumns: readonly (ProductEntityType | ChannelEntityType)[] = [];
