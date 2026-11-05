import { GlobeIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type PageTab, PageTabNav } from '~/modules/common/page/tab-nav';
import type { ProjectWithMembership } from '~/modules/project/types';
import { sortByMembership } from '~/modules/task/helpers/board-helpers';
import { workspaceRouteApi } from '~/modules/workspace/use-workspace-context';

interface ProjectTabNavProps {
  projects: ProjectWithMembership[];
}

/** Project tabs of the mobile workspace board, also drawn by its skeleton so the bar does not shift when the board loads. */
export function ProjectTabNav({ projects }: ProjectTabNavProps) {
  const { t } = useTranslation();
  const projectSlug = workspaceRouteApi.useSearch({ select: (search) => search.projectSlug });

  const tabs = sortByMembership(projects).map(
    (project): PageTab => ({
      id: project.id,
      text: project.name,
      icon: project.public ? <GlobeIcon role="img" aria-label={t('c:public_project')} className="size-4 shrink-0" /> : undefined,
      path: '/$tenantId/$organizationSlug/workspace/$slug',
      search: (prev) => ({ ...prev, projectSlug: project.slug }),
      activeOptions: { exact: false, includeSearch: true },
    }),
  );

  return <PageTabNav fallbackToFirst={!projectSlug} tabs={tabs} className="max-sm:border-t" />;
}
