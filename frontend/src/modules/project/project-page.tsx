import { type ReactNode, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization } from 'sdk';
import { FocusViewContainer } from '~/modules/common/focus-view';
import { PageHeader } from '~/modules/common/page/header';
import { toaster } from '~/modules/common/toaster/toaster';
import { useResolveCan } from '~/modules/entities/use-resolve-can';
import { useProjectUpdateMutation } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { useTaskDropMonitor } from '~/modules/task/hooks/use-task-drop-monitor';
import { TaskSheetHandler } from '~/modules/task/task-sheet-handler';
import { TasksHotkeys } from '~/modules/task/tasks-hotkeys';
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
  const resolveCan = useResolveCan();
  const canUpdate = resolveCan(project.can?.project?.update, project.createdBy);

  const updateProject = useProjectUpdateMutation();

  useTaskDropMonitor(project.tenantId, project.organizationId);

  const coverUpdateCallback = (bannerUrl: string) => {
    updateProject.mutate(
      { path: { id: project.id, organizationId: project.organizationId, tenantId: project.tenantId }, body: { bannerUrl } },
      { onSuccess: () => toaster.success(t('c:success.upload_cover')) },
    );
  };

  return (
    <>
      <PageHeader
        entity={project}
        canUpdate={canUpdate}
        organizationId={project.organizationId}
        parents={[organization]}
        coverUpdateCallback={coverUpdateCallback}
        panel={
          project.membership && (
            <Suspense>
              <div className="flex items-center p-2">
                <JoinedButton channel={project} role={project.membership.role} />
              </div>
            </Suspense>
          )
        }
      />
      <TaskSheetHandler />
      <TasksHotkeys projects={[project]} />
      <FocusViewContainer className="max-w-none gap-0 p-0 sm:gap-2 sm:p-3 md:gap-3">{children}</FocusViewContainer>
    </>
  );
}
