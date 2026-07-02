import { useNavigate, useSearch } from '@tanstack/react-router';
import { Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import { useDialoger } from '~/modules/common/dialoger/use-dialoger';
import { useSheeter } from '~/modules/common/sheeter/use-sheeter';
import DeleteProjects from '~/modules/project/delete-projects';
import UpdateProjectForm from '~/modules/project/update-project-form';
import { Button } from '~/modules/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/modules/ui/card';

export const ProjectSettings = ({ sheet: isSheet, project }: { sheet?: boolean; project: Project }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { projectSlug } = useSearch({ strict: false }) as { projectSlug?: string };

  const deleteButtonRef = useRef(null);

  const callback = (deletedProjects: Project[]) => {
    if (isSheet) useSheeter.getState().remove('update-project');

    // If the deleted project is the currently selected one, clear the search param
    // so the board defaults to the first remaining project
    const deletedSlugs = new Set(deletedProjects.map(({ slug }) => slug));
    if (projectSlug && deletedSlugs.has(projectSlug)) {
      navigate({
        to: '.',
        params: true,
        resetScroll: false,
        search: (prev) => ({ ...prev, projectSlug: undefined }),
      });
    }
  };

  const openDeleteDialog = () => {
    useDialoger.getState().create(<DeleteProjects dialog projects={[project]} callback={callback} />, {
      id: 'delete-project',
      triggerRef: deleteButtonRef,
      className: 'md:max-w-xl',
      title: t('c:delete_resource', { resource: t('c:project').toLowerCase() }),
      description: t('c:confirm.delete_resource', {
        name: project.name,
        resource: t('c:project').toLowerCase(),
      }),
    });
  };

  return (
    <div className="mb-12 flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('c:general')}</CardTitle>
        </CardHeader>
        <CardContent>
          <UpdateProjectForm project={project} sheet={isSheet} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('c:delete_resource', { resource: t('c:project').toLowerCase() })}</CardTitle>
          <CardDescription>
            <Trans
              i18nKey="c:delete_resource_notice.text"
              values={{ name: project.name, resource: t('c:project').toLowerCase() }}
            />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button ref={deleteButtonRef} variant="destructive" className="w-full sm:w-auto" onClick={openDeleteDialog}>
            <Trash2 className="mr-2 h-4 w-4" />
            <span>{t('c:delete_resource', { resource: t('c:project').toLowerCase() })}</span>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
