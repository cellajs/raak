import { useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { ArrowRightIcon, EllipsisVerticalIcon, SettingsIcon, UsersIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-organization-layout-context';
import { DropdownActionItem, DropdownActionSeparator } from '~/modules/common/dropdowner/dropdown-action-item';
import { dropdowner } from '~/modules/common/dropdowner/use-dropdowner';
import { NamedText } from '~/modules/common/named-text';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { organizationQueryOptions } from '~/modules/organization/query';
import { openProjectMembersSheet, openProjectSettingsSheet } from '~/modules/project/project-actions';
import type { EnrichedProject } from '~/modules/project/types';
import { Button } from '~/modules/ui/button';
import { findWorkspaceByIdOrSlug } from '~/modules/workspace/query';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';
import { cn } from '~/utils/cn';

interface ProjectActionsMenuProps {
  project: EnrichedProject;
  className?: string;
}

/** Project menu: in the project panel header on a workspace board, in the board header on a project page. */
export function ProjectActionsMenu({ project, className }: ProjectActionsMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isInWorkspace = useIsWorkspaceRoute();

  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const { data: organization } = useSuspenseQuery(organizationQueryOptions(organizationId, tenantId));

  const projectMembership = project.membership;
  const projectWorkspace = projectMembership?.workspaceId ? findWorkspaceByIdOrSlug(projectMembership.workspaceId, tenantId) : undefined;

  const hasGoTo = isInWorkspace || !!projectWorkspace;

  const openOptionsDropdown = (currentTarget: HTMLButtonElement) => {
    const triggerRef = { current: currentTarget };
    const closeThen = (action: () => void) => () => {
      dropdowner.getState().remove();
      action();
    };

    dropdowner.getState().create(
      <>
        {isInWorkspace && (
          <DropdownActionItem
            icon={ArrowRightIcon}
            onSelect={closeThen(() =>
              navigate({
                to: '/$tenantId/$organizationSlug/project/$slug',
                params: { slug: project.slug, organizationSlug: organization.slug, tenantId },
              }),
            )}
          >
            {t('c:go_to_project')}
          </DropdownActionItem>
        )}
        {!isInWorkspace && projectWorkspace && (
          <DropdownActionItem
            icon={ArrowRightIcon}
            onSelect={closeThen(() =>
              navigate({
                to: '/$tenantId/$organizationSlug/workspace/$slug',
                params: { slug: projectWorkspace.slug, organizationSlug: organization.slug, tenantId },
                search: { projectSlug: project.slug },
              }),
            )}
          >
            {t('c:go_to_workspace')}
          </DropdownActionItem>
        )}
        {projectMembership && (
          <>
            {hasGoTo && <DropdownActionSeparator />}
            <DropdownActionItem icon={UsersIcon} onSelect={closeThen(() => openProjectMembersSheet(project, triggerRef))}>
              {t('c:project_members')}
            </DropdownActionItem>
            <DropdownActionItem icon={SettingsIcon} onSelect={closeThen(() => openProjectSettingsSheet(project, triggerRef))}>
              {t('c:resource_settings', { resource: t('c:project') })}
            </DropdownActionItem>
          </>
        )}
      </>,
      {
        id: `project-options-${project.id}`,
        triggerId: `project-options-btn-${project.id}`,
        triggerRef,
        align: 'end',
        kind: 'menu',
        lead: <NamedText i18nKey="c:resource_named" name={project.name} values={{ resource: t('c:project') }} />,
        popupClassName: 'min-w-48',
      },
    );
  };

  // A non-member on a project page has nothing to pick
  if (!isInWorkspace && !projectMembership) return null;

  return (
    <TooltipButton toolTipContent={t('c:resource_options', { resource: t('c:project') })}>
      <Button
        variant="ghost"
        aria-label={t('c:resource_options', { resource: t('c:project') })}
        onClick={({ currentTarget }) => openOptionsDropdown(currentTarget)}
        className={cn('data-dropdowner-active:bg-muted', className)}
      >
        <EllipsisVerticalIcon />
      </Button>
    </TooltipButton>
  );
}
