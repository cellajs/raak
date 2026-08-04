import { useSuspenseInfiniteQuery, useSuspenseQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { VariantProps } from 'class-variance-authority';
import { EllipsisVerticalIcon, PlusIcon, SettingsIcon, UsersIcon } from 'lucide-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { createNewProject, openProjectMembersSheet, openProjectSettingsSheet } from '~/modules/project/project-actions';
import { projectsListQueryOptions } from '~/modules/project/query';
import type { EnrichedProject } from '~/modules/project/types';
import { Button, type buttonVariants } from '~/modules/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/modules/ui/dropdown-menu';
import { workspaceQueryOptions } from '~/modules/workspace/query';
import { useWorkspaceContext } from '~/modules/workspace/use-workspace-context';
import { flattenInfiniteData } from '~/query/basic/flatten';

/**
 * Action buttons for the workspace header, including create project and workspace settings.
 * Labels are managed in the always-present labels board panel.
 */
export function WorkspaceActionButtons() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { workspace: initialWorkspace } = useWorkspaceContext();

  const { data: workspace } = useSuspenseQuery(
    workspaceQueryOptions(initialWorkspace.id, initialWorkspace.organizationId, initialWorkspace.tenantId),
  );
  const { data: projectsData } = useSuspenseInfiniteQuery(
    projectsListQueryOptions({ workspaceId: workspace.id, include: 'counts' }),
  );
  const projects = flattenInfiniteData<Project>(projectsData);
  const { projectSlug, q: searchQuery } = useSearch({
    from: '/_app/$tenantId/$organizationSlug/workspace/$slug',
  });

  const project: EnrichedProject | undefined = projects.find((p) => p.slug === projectSlug) || projects[0];
  const projectMembership = project?.membership;

  const refs = {
    add: useRef(null),
    workspace: useRef(null),
    project: useRef(null),
  };

  // Opens the URL-driven workspace settings sheet (see WorkspaceSettingsSheetHandler)
  const openPreferencesSheet = () =>
    navigate({
      to: '.',
      resetScroll: false,
      search: (prev) => ({ ...prev, workspaceSettingsId: workspace.id }),
    });

  const actions = [
    {
      key: 'add',
      icon: <PlusIcon />,
      label: t('c:add_resource', { resource: t('c:project').toLowerCase() }),
      onClick: createNewProject,
      ref: refs.add,
      variant: 'plain',
    },
    {
      key: 'workspace',
      icon: <SettingsIcon />,
      label: t('c:resource_settings', { resource: t('c:workspace') }),
      onClick: openPreferencesSheet,
      ref: refs.workspace,
      variant: 'outline',
    },
  ];

  return (
    <>
      {/* Desktop Buttons */}
      {actions.map(({ key, icon, label, onClick, ref, variant }) => (
        <TooltipButton key={key} className="max-md:hidden" toolTipContent={label}>
          <Button ref={ref} variant={variant as VariantProps<typeof buttonVariants>['variant']} onClick={onClick}>
            {icon}
            {key === 'add' && (
              <>
                <span className="ml-1 max-md:hidden xl:hidden">{t('c:add')}</span>
                <span className="ml-1 max-xl:hidden">{label}</span>
              </>
            )}
          </Button>
        </TooltipButton>
      ))}

      {/* Mobile Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={`group-data-[search-focused=true]/boardHeader:hidden md:hidden ${searchQuery && 'hidden'}`}
          render={<Button variant="ghost" aria-label="Workspace options" />}
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-48 p-1" align="end">
          {actions.map(({ key, icon, label, onClick, ref }) => (
            <DropdownMenuItem key={key} ref={ref} onClick={onClick} className="flex items-center gap-2">
              {icon}
              <span>{label}</span>
            </DropdownMenuItem>
          ))}
          {projectMembership && <DropdownMenuSeparator />}

          {project && projectMembership && (
            <DropdownMenuItem onClick={() => openProjectMembersSheet(project)} className="flex items-center gap-2">
              <UsersIcon />
              <span>{t('c:project_members')}</span>
            </DropdownMenuItem>
          )}
          {project && projectMembership && (
            <DropdownMenuItem onClick={() => openProjectSettingsSheet(project)} className="flex items-center gap-2">
              <SettingsIcon />
              <span>{t('c:resource_settings', { resource: t('c:project') })}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
