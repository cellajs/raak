import { useSuspenseInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRightIcon, EllipsisVerticalIcon, PlusIcon, SettingsIcon, UsersIcon } from 'lucide-react';
import { type RefObject, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { DropdownActionItem, DropdownActionSeparator } from '~/modules/common/dropdowner/dropdown-action-item';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { useChannelSettingsSections } from '~/modules/entities/use-channel-settings-sections';
import { createNewProject, openProjectMembersSheet, openProjectSettingsSheet } from '~/modules/project/project-actions';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { useWithMembership } from '~/modules/project/use-with-membership';
import { DrawerDisplayOptions } from '~/modules/task/board/display-options';
import { sortByMembership } from '~/modules/task/helpers/board-helpers';
import { Button } from '~/modules/ui/button';
import { useWorkspaceContext, workspaceRouteApi } from '~/modules/workspace/use-workspace-context';
import { openWorkspaceSettingsSheet } from '~/modules/workspace/workspace-settings';
import { flattenInfiniteData } from '~/query/basic/flatten';
import { cn } from '~/utils/cn';

export function WorkspaceActionButtons() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { workspace, organization, tenantId } = useWorkspaceContext();

  // The board's list: an archived project has no tab, so the fallback below must name the first tab
  const { data: projectsData } = useSuspenseInfiniteQuery(
    projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts', excludeArchived: 'true' }),
  );
  const projects = sortByMembership(useWithMembership(flattenInfiniteData<EnrichedProject>(projectsData)));
  const projectSlug = workspaceRouteApi.useSearch({ select: (search) => search.projectSlug });
  const searchQuery = workspaceRouteApi.useSearch({ select: (search) => search.q });
  const view = workspaceRouteApi.useSearch({ select: (search) => search.view });

  // The table lists every project, with no tab to say which one the menu's project actions would hit
  const project = view === 'table' ? undefined : projects.find((candidate) => candidate.slug === projectSlug) || projects[0];
  const projectMembership = project?.membership;

  const refs = { add: useRef<HTMLButtonElement>(null), workspace: useRef<HTMLButtonElement>(null) };
  // A plain workspace member holds no grant any settings tool requires, so the sheet would open empty
  const hasSettings = useChannelSettingsSections(workspace).length > 0;

  const openWorkspaceSettings = (triggerRef: RefObject<HTMLButtonElement | null>) => openWorkspaceSettingsSheet(workspace, triggerRef);

  const actions = [
    {
      key: 'add',
      icon: PlusIcon,
      label: t('c:add_resource', { resource: t('c:project') }),
      onClick: createNewProject,
      ref: refs.add,
      variant: 'secondary' as const,
    },
    ...(hasSettings
      ? [
          {
            key: 'workspace',
            icon: SettingsIcon,
            label: t('c:resource_settings', { resource: t('c:workspace') }),
            onClick: openWorkspaceSettings,
            ref: refs.workspace,
            variant: 'outline' as const,
          },
        ]
      : []),
  ];

  const openMobileMenu = (currentTarget: HTMLButtonElement) => {
    const triggerRef = { current: currentTarget };
    const select = (action: () => void) => () => {
      dropdowner.getState().remove();
      action();
    };

    dropdowner.getState().create(
      <>
        <DrawerDisplayOptions />
        {actions.map(({ key, icon, label, onClick }) => (
          <DropdownActionItem key={key} icon={icon} onSelect={select(() => onClick(triggerRef))}>
            {label}
          </DropdownActionItem>
        ))}
        {project && (
          <>
            <DropdownActionSeparator />
            <DropdownActionItem
              icon={ArrowRightIcon}
              onSelect={select(() =>
                navigate({
                  to: '/$tenantId/$organizationSlug/project/$slug',
                  params: { slug: project.slug, organizationSlug: organization.slug, tenantId },
                }),
              )}
            >
              {t('c:go_to_project')}
            </DropdownActionItem>
            {projectMembership && (
              <>
                <DropdownActionItem icon={UsersIcon} onSelect={select(() => openProjectMembersSheet(project, triggerRef))}>
                  {t('c:project_members')}
                </DropdownActionItem>
                <DropdownActionItem icon={SettingsIcon} onSelect={select(() => openProjectSettingsSheet(project, triggerRef))}>
                  {t('c:resource_settings', { resource: t('c:project') })}
                </DropdownActionItem>
              </>
            )}
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
      {actions.map(({ key, icon: Icon, label, onClick, ref, variant }) => (
        <TooltipButton key={key} className="max-md:hidden" toolTipContent={label}>
          <Button ref={ref} variant={variant} onClick={() => onClick(ref)}>
            <Icon />
            {key === 'add' && (
              <>
                <span className="xl:hidden">{t('c:add')}</span>
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
        className={cn('data-dropdowner-active:bg-muted group-data-[search-focused=true]/boardHeader:hidden md:hidden', searchQuery && 'hidden')}
      >
        <EllipsisVerticalIcon />
      </Button>
    </>
  );
}
