import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { CountBadge } from '~/modules/common/count-badge';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { ChannelTileCard, ChannelTileHeading, ChannelTileRow } from '~/modules/entities/entity-grid/channel-tile';
import type { UserMenuItem } from '~/modules/me/types';
import { sortAndFilterMenu } from '~/modules/navigation/menu-sheet/helpers/sort-and-filter-menu';
import { menuUnseenChannelIds } from '~/modules/navigation/menu-sheet/helpers/use-menu-item-unseen-count';
import { useUnseenCount } from '~/modules/seen/use-unseen-count';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';

interface WorkspaceTileProps {
  entity: Workspace;
  /** Its row in the user's menu, which holds its projects and decides what counts as unseen. */
  menuItem?: UserMenuItem;
}

export function WorkspaceTile({ entity, menuItem }: WorkspaceTileProps) {
  const { t } = useTranslation();

  const projects = sortAndFilterMenu(menuItem?.submenu ?? [], false);
  const archivedCount = (menuItem?.submenu?.length ?? 0) - projects.length;
  const unseenCount = useUnseenCount(menuItem ? menuUnseenChannelIds(menuItem, true) : []);

  const leading = (
    // Exactly two overlapping avatars wide, so names line up from tile to tile and a pair sits a plain gap from its name
    <div className="flex w-12 shrink-0 items-center justify-center sm:w-16">
      {!!projects.length && (
        <AvatarGroup limit={2} className="-space-x-4">
          <AvatarGroupList>
            {projects.map((project) => (
              <EntityAvatar
                key={project.id}
                className="size-8 border-2 border-black/25 more-contrast:border-black/85 sm:size-10"
                type="project"
                id={project.id}
                name={project.name}
                url={project.thumbnailUrl}
              />
            ))}
          </AvatarGroupList>
          <AvatarOverflowIndicator className="size-8 rounded-md border-2 border-black/25 more-contrast:border-black/85 bg-muted font-semibold more-contrast:text-foreground text-faint-foreground text-xs tracking-tighter shadow-none sm:size-10" />
        </AvatarGroup>
      )}
    </div>
  );

  const meta = (
    <div className="truncate text-muted-foreground text-xs sm:text-sm">
      {projects.length > 0
        ? projects.map((project) => project.name).join(', ')
        : archivedCount > 0
          ? `${t('c:archived')} · ${archivedCount}`
          : t('c:no_resource_yet', { resource: t('c:project_other') })}
    </div>
  );

  return (
    <ChannelTileCard entity={entity}>
      <ChannelTileRow>
        <ChannelTileHeading leading={leading} meta={meta} />
        {unseenCount > 0 && <CountBadge count={unseenCount} className="shrink-0" />}
      </ChannelTileRow>
    </ChannelTileCard>
  );
}
