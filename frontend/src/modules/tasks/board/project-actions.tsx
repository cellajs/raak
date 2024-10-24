import { EllipsisVertical, Import, Plus, Settings, Users } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { importTasks } from '~/api/tasks';
import router from '~/lib/router';
import { showToast } from '~/lib/toasts';
import { dialog } from '~/modules/common/dialoger/state';
import { Button } from '~/modules/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/modules/ui/dropdown-menu';
import { Input } from '~/modules/ui/input';
import { useWorkspaceQuery } from '~/modules/workspaces/helpers/use-workspace';
import { useWorkspaceStore } from '~/store/workspace';
import { defaultColumnValues, useWorkspaceUIStore } from '~/store/workspace-ui';
import type { Project } from '~/types/app';
import { openProjectConfigSheet } from './helpers';

const ProjectActions = ({ project, openDialog }: { project: Project; openDialog: () => void }) => {
  const { t } = useTranslation();
  const { changeColumn, workspaces } = useWorkspaceUIStore();
  const { setFocusedTaskId } = useWorkspaceStore();

  const {
    data: { workspace },
  } = useWorkspaceQuery();

  const { createTaskForm } = workspaces[workspace.id]?.columns[project.id] || defaultColumnValues;

  // TODO: this doesnt look ok
  const role = project.membership?.role || 'member';

  const createTaskClick = () => {
    if (createTaskForm) setFocusedTaskId(null);
    changeColumn(workspace.id, project.id, {
      createTaskForm: !createTaskForm,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      await importTasks({
        organizationId: workspace.organizationId,
        projectId: project.id,
        file: formData.get('file') as File,
      });
      dialog.remove(false, 'import-tasks-form');
      showToast(t('app:imported_tasks.text'), 'success');
    } catch (error) {
      console.error('Error importing tasks:', error);
      showToast(t('app:import_failed.text'), 'error');
    }
  };

  const uploadFile = () => {
    dialog(
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} encType="multipart/form-data">
        <Input type="file" name="file" accept=".zip" required />
        <Button type="submit">{t('common:submit')}</Button>
      </form>,
      {
        title: t('common:import'),
        description: t('app:import_tasks.text'),
        id: 'import-tasks-form',
        className: 'max-w-2xl',
      },
    );
  };

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
          <DropdownMenuItem onClick={() => uploadFile()} className="flex items-center gap-2">
            <Import size={16} />
            <span>{t('common:import')}</span>
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
