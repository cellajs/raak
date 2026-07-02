import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { projectsListQueryOptions } from '~/modules/project/query';
import { AvatarGroup, AvatarGroupList, AvatarOverflowIndicator } from '~/modules/ui/avatar';
import { Card, CardContent } from '~/modules/ui/card';
import { getContextEntityRoute } from '~/utils/context-entity-route';

/**
 * Tile component for a workspace, showing its name and associated projects as avatars.
 *
 * Reads from the shared all-projects query (already fetched by sidebar/menu) and filters
 * by `membership.workspaceId`. React Query memoizes the `select` per subscriber, so each
 * tile only re-renders when its own slice changes — no N per-workspace project fetches.
 */
export const WorkspaceTile = ({ entity }: { entity: Workspace }) => {
  const { t } = useTranslation();
  const { to, params } = getContextEntityRoute(entity);

  const { data: projects = [] } = useInfiniteQuery({
    ...projectsListQueryOptions({}),
    select: (data) => data.pages.flatMap((p) => p.items).filter((p) => p.membership?.workspaceId === entity.id),
  });

  return (
    <Link
      to={to}
      draggable={false}
      params={params}
      className="tile-link relative w-full rounded-md transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-[.05rem]"
    >
      <Card className="overflow-hidden transition hover:shadow-sm">
        <CardContent>
          <div className="flex w-full items-center gap-3">
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
            <div className="flex grow flex-col gap-1 truncate">
              <div className="-mb-1.5 truncate font-semibold">{entity.name}</div>
              <div className="truncate text-sm opacity-70 transition-opacity group-hover:opacity-85">
                {projects.map((project, idx) => (
                  <span key={project.id}>
                    {project.name}
                    {idx < projects.length - 1 && ', '}
                  </span>
                ))}
                {projects.length === 0 && t('c:no_resource_yet', { resource: t('c:projects').toLowerCase() })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
