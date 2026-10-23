import type { TKey } from '~/lib/i18n-locales';
import { type PageTab, PageTabNav } from '~/modules/common/page/tab-nav';
import type { EnrichedProject } from '~/modules/project/types';
import { sortByMembership } from '~/modules/task/helpers/board-helpers';
import { workspaceRouteApi } from '~/modules/workspace/use-workspace-context';

interface ProjectTabNavProps {
  projects: EnrichedProject[];
}

/** Project tabs of the mobile workspace board, also drawn by its skeleton so the bar does not shift when the board loads. */
export function ProjectTabNav({ projects }: ProjectTabNavProps) {
  const projectSlug = workspaceRouteApi.useSearch({ select: (search) => search.projectSlug });

  const tabs = sortByMembership(projects).map(
    (project): PageTab => ({
      id: project.id,
      // Project names are display strings, not keys; PageTabNav's t() falls back to the raw name.
      label: project.name as TKey,
      path: '/$tenantId/$organizationSlug/workspace/$slug',
      search: { projectSlug: project.slug },
      activeOptions: { exact: false, includeSearch: true },
    }),
  );

  return <PageTabNav fallbackToFirst={!projectSlug} tabs={tabs} className="max-sm:border-t" />;
}
