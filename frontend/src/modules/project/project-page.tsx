import { useQuery } from '@tanstack/react-query';
import { type CSSProperties, type ReactNode, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useMeasure } from '~/hooks/use-measure';
import { FocusViewContainer } from '~/modules/common/focus-view';
import { PageHeader } from '~/modules/common/page/header';
import { toaster } from '~/modules/common/toaster/toaster';
import { useCan } from '~/modules/entities/use-can';
import { myMembershipsQueryOptions } from '~/modules/me/query';
import { PublicBadge, PublicProjectLabel } from '~/modules/project/public-project-indicators';
import { useProjectUpdateMutation } from '~/modules/project/query';
import { ProjectReadOnlyBadge } from '~/modules/project/read-only-badge';
import type { EnrichedProject } from '~/modules/project/types';
import { useProjectHeaderShown } from '~/modules/task/board/task-board-store';
import { useTaskDropMonitor } from '~/modules/task/hooks/use-task-drop-monitor';
import { TaskSheetHandler } from '~/modules/task/task-sheet-handler';
import { TasksHotkeys } from '~/modules/task/tasks-hotkeys';
import { findMembership } from '~/query/enrichment/helpers';
import { lazyNamed } from '~/utils/lazy-named';

const JoinedButton = lazyNamed(() => import('~/modules/memberships/joined-button'), 'JoinedButton');

interface ProjectPageProps {
  project: EnrichedProject;
  organization: Organization;
  children: ReactNode;
}

export function ProjectPage({ project, organization, children }: ProjectPageProps) {
  const { t } = useTranslation();

  // From the policy, so an organization admin without a project admin membership gets the same affordances the API grants.
  const can = useCan();
  const canUpdate = can('update', 'project', project);
  const { data: myMemberships } = useQuery(myMembershipsQueryOptions());
  const membership = findMembership(myMemberships?.items ?? [], project.id);

  const isMobile = useBreakpointBelow('sm');
  const isHeaderShown = useProjectHeaderShown(project.id);
  // Measured: a cover's height follows the viewport and whether it has an image, and focus view hides the header
  const { ref: headerRef, bounds: headerBounds } = useMeasure<HTMLDivElement>();

  const updateProject = useProjectUpdateMutation();

  useTaskDropMonitor(project.tenantId, project.organizationId);

  const onCoverUpdate = (bannerUrl: string) => {
    updateProject.mutate(
      { path: { id: project.id, organizationId: project.organizationId, tenantId: project.tenantId }, body: { bannerUrl } },
      { onSuccess: () => toaster.success(t('c:success.upload_cover')) },
    );
  };

  return (
    <>
      <div ref={headerRef}>
        {(isHeaderShown || isMobile) && (
          <PageHeader
            entity={project}
            canUpdate={canUpdate}
            organizationId={project.organizationId}
            parents={[organization]}
            onCoverUpdate={onCoverUpdate}
            avatarBadge={project.public && <PublicBadge large />}
            typeLabel={project.public ? <PublicProjectLabel editableProject={canUpdate ? project : undefined} /> : undefined}
            panel={
              membership && (
                <Suspense>
                  <div className="flex items-center gap-2 p-2">
                    <ProjectReadOnlyBadge projectId={project.id} />
                    <JoinedButton channel={project} role={membership.role} iconOnlyOnPhone />
                  </div>
                </Suspense>
              )
            }
          />
        )}
      </div>
      <TaskSheetHandler />
      <TasksHotkeys projects={[project]} />
      {/* sm:min-h-0: a full-height container below the header would scroll the page, and wheel events over a column would then fight the column's own scroll */}
      <FocusViewContainer className="max-w-none gap-0 p-0 sm:min-h-0 sm:gap-2 sm:p-3 md:gap-3">
        <div className="project-board-offsets contents" style={{ '--project-header-h': `${headerBounds.height}px` } as CSSProperties}>
          {children}
        </div>
      </FocusViewContainer>
    </>
  );
}
