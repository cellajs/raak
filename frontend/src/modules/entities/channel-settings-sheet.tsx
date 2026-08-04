import { useQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { appConfig, type ChannelEntityType } from 'shared';
import type { ToolsConfig } from 'shared/tools-config';
import { type ChannelEntityContext, getChannelSettingsTools, resolvePlacementList } from '~/lib/placements';
import { heldContextRoles } from '~/modules/entities/context-roles';
import { useResolveCan } from '~/modules/entities/use-resolve-can';
import { myMembershipsQueryOptions } from '~/modules/me/query';

interface ChannelSettingsSheetProps<C extends ChannelEntityType> {
  entity: ChannelEntityContext<C> & { entityType: C; toolsConfig?: ToolsConfig };
}

/**
 * Sheet-hosted consumer for a channel entity's `settings` slot: same tool resolution as
 * `ChannelSettingsPage` (app overrides, `toolsConfig` arrangement, `requires` and `visibleTo`
 * gating), rendered as stacked sections without the page aside.
 */
export function ChannelSettingsSheet<C extends ChannelEntityType>({ entity }: ChannelSettingsSheetProps<C>) {
  const channelType = entity.entityType;
  const slot = `${channelType}.settings`;

  // Grants: every entity action the actor holds on this channel, resolved per row
  const resolveCan = useResolveCan();
  const can = entity.can?.[channelType];
  const grants = appConfig.entityActions.filter((action) => resolveCan(can?.[action], entity.createdBy));

  const { data: myMemberships } = useQuery(myMembershipsQueryOptions());
  const pairs = heldContextRoles(entity, myMemberships?.items ?? []);

  const sections = resolvePlacementList(
    slot,
    getChannelSettingsTools(channelType).map((tool) => ({ ...tool, order: tool.order ?? 50 })),
    { grants, pairs, slotConfig: entity.toolsConfig?.[slot] },
  );

  return (
    <div className="mb-12 flex flex-col gap-8">
      {sections.map((tool) => (
        <Suspense key={tool.id} fallback={null}>
          {tool.render(entity)}
        </Suspense>
      ))}
    </div>
  );
}
