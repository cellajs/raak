import { EllipsisVertical, Minimize2, Plus, Settings, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import router from '~/lib/router';
import { showToast } from '~/lib/toasts';
import { dialog } from '~/modules/common/dialoger/state';
import { Button } from '~/modules/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/modules/ui/dropdown-menu';
import { useWorkspaceQuery } from '~/modules/workspaces/helpers/use-workspace';
import { useWorkspaceStore } from '~/store/workspace';
import { useWorkspaceUIStore } from '~/store/workspace-ui';
import type { Project } from '~/types/app';
import { openProjectConfigSheet } from './helpers';

const ProjectActions = ({ project, openDialog }: { project: Project; openDialog: () => void }) => {
  const { t } = useTranslation();
  const { changeColumn, workspaces } = useWorkspaceUIStore();
  const { setFocusedTaskId } = useWorkspaceStore();

  const {
    data: { workspace, projects },
  } = useWorkspaceQuery();

  const { minimized, createTaskForm } = workspaces[workspace.id]?.[project.id] || { minimized: false, createTaskForm: false };

  // TODO: this doesnt look ok
  const role = project.membership?.role || 'member';

  const minimizeClick = () => {
    // Check if all other projects are minimized
    const allOtherMinimized = projects.every((p) => {
      return p.id === project.id || workspaces[workspace.id]?.[p.id]?.minimized;
    });

    if (allOtherMinimized) return showToast(t('app:no_minimize_last'), 'error');

    // Proceed with minimizing the current project
    changeColumn(workspace.id, project.id, {
      minimized: true,
    });
  };

  const createTaskClick = () => {
    if (createTaskForm) setFocusedTaskId(null);
    changeColumn(workspace.id, project.id, {
      createTaskForm: !createTaskForm,
    });
  };

  if (minimized) return null;

  useEffect(() => {
    const unsubscribe = router.subscribe('onBeforeLoad', () => dialog.remove(false, `create-task-form-${project.id}`));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!createTaskForm) dialog.remove(false, `create-task-form-${project.id}`);
    else setTimeout(() => openDialog(), 0);
  }, [createTaskForm]);

  return (
    <>
      <div className="grow hidden sm:block" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="xs" className="max-sm:hidden" aria-label="Project options">
            <EllipsisVertical size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-48" align="end">
          <DropdownMenuItem onClick={() => openProjectConfigSheet(project)} className="flex items-center gap-2">
            {role === 'admin' ? <Settings size={16} /> : <Users size={16} />}
            <span>{role === 'admin' ? t('common:resource_settings', { resource: t('app:project') }) : t('app:project_members')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={minimizeClick} className="hidden  sm:flex items-center gap-2">
            <Minimize2 size={16} />
            <span>{t('common:minimize')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button data-form-open={createTaskForm} variant="plain" size="xs" className="rounded hidden sm:inline-flex" onClick={createTaskClick}>
        <Plus size={18} className="[[data-form-open=true]_&]:rotate-45 transition-transform duration-200" />
        <span className="ml-1">{t('app:task')}</span>
      </Button>
      <div className="grow sm:hidden" />
    </>
  );
};

export default ProjectActions;
