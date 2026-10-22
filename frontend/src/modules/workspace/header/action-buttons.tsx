import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { VariantProps } from 'class-variance-authority';
import { EllipsisVerticalIcon, PlusIcon, SettingsIcon, UsersIcon } from 'lucide-react';
import { type RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { DropdownActionItem } from '~/modules/common/dropdowner/dropdown-action-item';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { UnsavedBadge } from '~/modules/common/unsaved-badge';
import { createNewProject, openProjectMembersSheet, openProjectSettingsSheet } from '~/modules/project/project-actions';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { Button, type buttonVariants } from '~/modules/ui/button';
import { workspaceQueryOptions } from '~/modules/workspace/query';
import { useWorkspaceContext, workspaceRouteApi } from '~/modules/workspace/use-workspace-context';
import { WorkspaceSettings } from '~/modules/workspace/workspace-settings';
import { flattenInfiniteData } from '~/query/basic/flatten';
import { cn } from '~/utils/cn';

/**
 * Action buttons for the workspace header, including create project and workspace settings.
 * Labels are managed in the always-present labels board panel.
 */
export function WorkspaceActionButtons() {
  const { t } = useTranslation();

  const { workspace: initialWorkspace } = useWorkspaceContext();

  const { data: workspace } = useSuspenseQuery(
    workspaceQueryOptions(initialWorkspace.id, initialWorkspace.organizationId, initialWorkspace.tenantId),
  );
  const { data: projectsData } = useSuspenseInfiniteQuery(projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts' }));
  const projects = flattenInfiniteData<Project>(projectsData);
  const projectSlug = workspaceRouteApi.useSearch({ select: (search) => search.projectSlug });
  const searchQuery = workspaceRouteApi.useSearch({ select: (search) => search.q });

  const project: EnrichedProject | undefined = projects.find((p) => p.slug === projectSlug) || projects[0];
  const projectMembership = project?.membership;

  const refs = { add: useRef(null), workspace: useRef(null), project: useRef(null) };

  const openPreferencesSheet = (triggerRef: RefObject<HTMLButtonElement | null>) =>
    useSheeter.getState().create(
      <div className="container w-full">
        <WorkspaceSettings workspace={workspace} sheet />
      </div>,
      {
        id: 'update-workspace',
        triggerRef,
        side: 'right',
        className: 'max-w-full lg:max-w-4xl',
        title: t('c:resource_settings', { resource: t('c:workspace') }),
        titleContent: <UnsavedBadge title={t('c:resource_settings', { resource: t('c:workspace') })} />,
        description: t('c:workspace_settings.text', { name: workspace.name }),
      },
    );

  const actions = [
    {
      key: 'add',
      icon: PlusIcon,
      label: t('c:add_resource', { resource: t('c:project').toLowerCase() }),
      onClick: createNewProject,
      ref: refs.add,
      variant: 'plain',
    },
    {
      key: 'workspace',
      icon: SettingsIcon,
      label: t('c:resource_settings', { resource: t('c:workspace') }),
      onClick: openPreferencesSheet,
      ref: refs.workspace,
      variant: 'outline',
    },
  ];

  const openMobileMenu = (currentTarget: HTMLButtonElement) => {
    const isMobile = window.innerWidth < 640;
    const triggerRef = { current: currentTarget };
    const select = (action: () => void) => () => {
      useDropdowner.getState().remove();
      action();
    };

    useDropdowner.getState().create(
      <>
        {actions.map(({ key, icon, label, onClick }) => (
          <DropdownActionItem key={key} isMobile={isMobile} icon={icon} onSelect={select(() => onClick(triggerRef))}>
            {label}
          </DropdownActionItem>
        ))}
        {project && projectMembership && (
          <>
            <DropdownActionItem isMobile={isMobile} icon={UsersIcon} onSelect={select(() => openProjectMembersSheet(project, triggerRef))}>
              {t('c:project_members')}
            </DropdownActionItem>
            <DropdownActionItem isMobile={isMobile} icon={SettingsIcon} onSelect={select(() => openProjectSettingsSheet(project, triggerRef))}>
              {t('c:resource_settings', { resource: t('c:project') })}
            </DropdownActionItem>
          </>
        )}
      </>,
      {
        id: 'workspace-options',
        triggerId: 'workspace-options-btn',
        triggerRef,
        align: 'end',
        kind: 'menu',
        popupClassName: 'min-w-48',
      },
    );
  };

  return (
    <>
      {/* Desktop Buttons */}
      {actions.map(({ key, icon: Icon, label, onClick, ref, variant }) => (
        <TooltipButton key={key} className="max-md:hidden" toolTipContent={label}>
          <Button ref={ref} variant={variant as VariantProps<typeof buttonVariants>['variant']} onClick={() => onClick(ref)}>
            <Icon />
            {key === 'add' && (
              <>
                <span className="max-md:hidden xl:hidden">{t('c:add')}</span>
                <span className="max-xl:hidden">{label}</span>
              </>
            )}
          </Button>
        </TooltipButton>
      ))}

      <Button
        variant="ghost"
        aria-label={t('c:resource_options', { resource: t('c:workspace') })}
        onClick={({ currentTarget }) => openMobileMenu(currentTarget)}
        className={cn('data-dropdowner-active:bg-accent/50 group-data-[search-focused=true]/boardHeader:hidden md:hidden', searchQuery && 'hidden')}
      >
        <EllipsisVerticalIcon />
      </Button>
    </>
  );
}
