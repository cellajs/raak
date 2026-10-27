import i18n from 'i18next';
import type { RefObject } from 'react';
import type { Project } from 'sdk';
import { dialoger } from '~/modules/common/dialoger/use-dialoger';
import { NamedText } from '~/modules/common/named-text';
import { sheeter } from '~/modules/common/sheeter/use-sheeter';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { MembersTable } from '~/modules/memberships/members-table/members-table';
import { AddProjects } from '~/modules/project/add-projects';
import { ProjectSettings } from '~/modules/project/project-settings';
import type { EnrichedProject } from '~/modules/project/types';
import { fallbackContentRef } from '~/utils/fallback-content-ref';

export const openProjectMembersSheet = (project: Project, triggerRef?: RefObject<HTMLButtonElement | null>) => {
  sheeter.getState().create(
    <div className="container">
      <MembersTable channel={project} isSheet />
    </div>,
    {
      id: 'project-members',
      triggerRef: triggerRef || fallbackContentRef,
      side: 'right',
      headerClassName: 'static',
      title: i18n.t('c:project_members'),
      description: <NamedText i18nKey="c:project_members.text" name={project.name} />,
    },
  );
};

export const openProjectSettingsSheet = (project: EnrichedProject, triggerRef?: RefObject<HTMLButtonElement | null>) => {
  sheeter.getState().create(
    <div className="container">
      <ProjectSettings project={project} />
    </div>,
    {
      id: 'update-project',
      triggerRef: triggerRef || fallbackContentRef,
      side: 'right',
      title: i18n.t('c:resource_settings', { resource: i18n.t('c:project') }),
      titleContent: <UnsavedBadge title={i18n.t('c:resource_settings', { resource: i18n.t('c:project') })} />,
      description: <NamedText i18nKey="c:project_settings.text" name={project.name} />,
    },
  );
};

const openAddProjectsDialog = (mode?: 'select') => {
  const title = i18n.t('c:add_resource', { resource: i18n.t('c:project').toLowerCase() });
  dialoger.getState().create(<AddProjects mode={mode} />, {
    triggerRef: { current: null },
    className: 'md:max-w-4xl',
    id: 'create-project',
    title,
    titleContent: <UnsavedBadge title={title} />,
    description: i18n.t('c:add_projects.text'),
  });
};

/** Opens the add-projects dialog, where a project is created or an existing one selected. */
export const createNewProject = () => openAddProjectsDialog();

/** Opens the add-projects dialog directly on the "select existing projects" step. */
export const selectExistingProjects = () => openAddProjectsDialog('select');
