import { t } from 'i18next';
import type { RefObject } from 'react';
import type { Project } from 'sdk';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { MembersTable } from '~/modules/memberships/members-table/members-table';
import { AddProjects } from '~/modules/project/add-project';
import { ProjectSettings } from '~/modules/project/project-settings';
import type { EnrichedProject } from '~/modules/project/types';
import { fallbackContentRef } from '~/utils/fallback-content-ref';

/**
 * Opens the project members sheet.
 */
export const openProjectMembersSheet = (project: Project, triggerRef?: RefObject<HTMLButtonElement | null>) => {
  const contextEntity = { ...project, tenantId: project.tenantId };

  useSheeter.getState().create(
    <div className="container w-full">
      <MembersTable contextEntity={contextEntity} isSheet />
    </div>,
    {
      id: 'project-members',
      triggerRef: triggerRef || fallbackContentRef,
      side: 'right',
      headerClassName: 'static',
      className: 'max-w-full lg:max-w-4xl',
      title: t('c:project_members'),
      description: t('c:project_members.text'),
    },
  );
};

/**
 * Opens the project settings sheet.
 */
export const openProjectSettingsSheet = (
  project: EnrichedProject,
  triggerRef?: RefObject<HTMLButtonElement | null>,
) => {
  useSheeter.getState().create(
    <div className="container w-full">
      <ProjectSettings project={project} sheet />
    </div>,
    {
      id: 'update-project',
      triggerRef: triggerRef || fallbackContentRef,
      side: 'right',
      className: 'max-w-full lg:max-w-4xl',
      title: t('c:resource_settings', { resource: t('c:project') }),
      titleContent: <UnsavedBadge title={t('c:resource_settings', { resource: t('c:project') })} />,
      description: t('c:project_settings.text', { name: project.name }),
    },
  );
};

export const createNewProject = () => {
  const title = t('c:add_resource', { resource: t('c:project').toLowerCase() });
  useDialoger.getState().create(<AddProjects dialog />, {
    triggerRef: { current: null },
    className: 'md:max-w-4xl',
    id: 'create-project',
    title,
    titleContent: <UnsavedBadge title={title} />,
    description: t('c:add_projects.text'),
  });
};

/**
 * Opens the add-projects dialog directly on the "select existing projects" step.
 */
export const selectExistingProjects = () => {
  const title = t('c:add_resource', { resource: t('c:project').toLowerCase() });
  useDialoger.getState().create(<AddProjects dialog mode="select" />, {
    triggerRef: { current: null },
    className: 'md:max-w-4xl',
    id: 'create-project',
    title,
    titleContent: <UnsavedBadge title={title} />,
    description: t('c:add_projects.text'),
  });
};
