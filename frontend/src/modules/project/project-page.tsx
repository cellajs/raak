import { useSuspenseQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Organization } from 'sdk';
import { FocusViewContainer } from '~/modules/common/focus-view';
import { PageHeader } from '~/modules/common/page/header';
import { toaster } from '~/modules/common/toaster/toaster';
import { projectQueryOptions, useProjectUpdateMutation } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { TaskSheetHandler } from '~/modules/task/task-sheet-handler';
import { TasksHotkeys } from '~/modules/task/tasks-hotkeys';

interface Props {
  projectId: string;
  organizationId: string;
  organization: Organization;
  tenantId: string;
  children: ReactNode;
}

/**
 * Project page with header, hotkeys and nested routes.
 */
export function ProjectPage({ projectId, organizationId, organization, tenantId, children }: Props) {
  const { t } = useTranslation();

  const { data } = useSuspenseQuery(projectQueryOptions(projectId, organizationId, tenantId));
  const project = data as EnrichedProject;

  const isAdmin = project.membership?.role === 'admin';

  const updateProject = useProjectUpdateMutation();

  const coverUpdateCallback = (bannerUrl: string) => {
    updateProject.mutate(
      { path: { id: projectId, organizationId, tenantId }, body: { bannerUrl } },
      {
        onSuccess: () => toaster.success(t('c:success.upload_cover')),
        onError: () => toaster.error(t('error:image_upload_failed')),
      },
    );
  };

  return (
    <>
      <PageHeader
        entity={project}
        canUpdate={isAdmin}
        organizationId={project.organizationId}
        parent={organization}
        coverUpdateCallback={coverUpdateCallback}
      />
      <TaskSheetHandler />
      <TasksHotkeys boardId={project.id} projects={[project]} type="project" />
      <FocusViewContainer className="group/project max-w-none gap-0 p-0 sm:gap-2 sm:p-3 md:gap-3">
        {children}
      </FocusViewContainer>
    </>
  );
}
