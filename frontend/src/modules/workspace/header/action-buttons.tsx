import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import type { VariantProps } from 'class-variance-authority';
import { EllipsisVerticalIcon, PlusIcon, SettingsIcon, UsersIcon } from 'lucide-react';
import { type RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { DropdownActionItem } from '~/modules/common/dropdowner/dropdown-action-item';
import { useDropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { createNewProject, openProjectMembersSheet, openProjectSettingsSheet } from '~/modules/project/project-actions';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { Button, type buttonVariants } from '~/modules/ui/button';
import { useWorkspaceContext, workspaceRouteApi } from '~/modules/workspace/use-workspace-context';
import { openWorkspaceSettingsSheet } from '~/modules/workspace/workspace-settings';
import { flattenInfiniteData } from '~/query/basic/flatten';
import { cn } from '~/utils/cn';

/**
 * Action buttons for the workspace header: add project and workspace settings.
 */
export function WorkspaceActionButtons() {
  const { t } = useTranslation();

  const { workspace } = useWorkspaceContext();

  const { data: projectsData } = useSuspenseInfiniteQuery(projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts' }));
  const projects = flattenInfiniteData<Project>(projectsData);
  const projectSlug = workspaceRouteApi.useSearch({ select: (search) => search.projectSlug });
  const searchQuery = workspaceRouteApi.useSearch({ select: (search) => search.q });

  const project: EnrichedProject | undefined = projects.find((p) => p.slug === projectSlug) || projects[0];
  const projectMembership = project?.membership;

  const refs = { add: useRef(null), workspace: useRef(null) };

  const openPreferencesSheet = (triggerRef: RefObject<HTMLButtonElement | null>) => openWorkspaceSettingsSheet(workspace, triggerRef);

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
