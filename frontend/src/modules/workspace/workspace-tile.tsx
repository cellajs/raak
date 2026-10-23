import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { ChannelTileCard, ChannelTileHeading, ChannelTileRow } from '~/modules/entities/entity-grid/channel-tile';
import { projectsListQueryOptions } from '~/modules/project/query';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';

interface WorkspaceTileProps {
  entity: Workspace;
}

/**
 * A banner-less workspace tile, showing its name and associated projects as avatars.
 * Reads the shared all-projects query (already fetched by the menu), so no per-workspace fetch.
 */
export function WorkspaceTile({ entity }: WorkspaceTileProps) {
  const { t } = useTranslation();

  const { data: projects = [] } = useInfiniteQuery({
    ...projectsListQueryOptions({}),
    select: (data) => data.pages.flatMap((page) => page.items).filter((project) => project.membership?.workspaceId === entity.id),
  });

  const leading = (
    <div className="flex min-w-14 items-center justify-center">
      {!!projects.length && (
        <AvatarGroup limit={2}>
          <AvatarGroupList>
            {projects.map((project) => (
              <EntityAvatar
                key={project.id}
                className="-ml-2 h-10 w-10 border"
                type="project"
                id={project.id}
                name={project.name}
                url={project.thumbnailUrl}
              />
            ))}
          </AvatarGroupList>
          <AvatarOverflowIndicator className="-ml-2 h-10 w-10 rounded-md border text-xs" />
        </AvatarGroup>
      )}
    </div>
  );

  const meta = (
    <div className="truncate text-muted-foreground text-sm">
      {projects.length > 0
        ? projects.map((project) => project.name).join(', ')
        : t('c:no_resource_yet', { resource: t('c:project_other').toLowerCase() })}
    </div>
  );

  return (
    <ChannelTileCard entity={entity}>
      <ChannelTileRow>
        <ChannelTileHeading leading={leading} meta={meta} />
      </ChannelTileRow>
    </ChannelTileCard>
  );
}
