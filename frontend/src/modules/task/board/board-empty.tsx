import { BirdIcon, PlusIcon, RedoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Workspace } from 'sdk';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { createNewProject } from '~/modules/project/project-actions';
import { AvailableProjectsEmptyAction } from '~/modules/task/board/available-projects-empty-action';
import { Button } from '~/modules/ui/button';

interface BoardEmptyProps {
  workspace?: Workspace;
  publicView?: boolean;
}

export function BoardEmpty({ workspace, publicView }: BoardEmptyProps) {
  const { t } = useTranslation();
  const isTablet = useBreakpointBelow('md');

  const createProjectAction = isTablet ? (
    <Button variant="plain" onClick={createNewProject}>
      <PlusIcon />
      <span>{`${t('c:add')} ${t('c:project').toLowerCase()}`}</span>
    </Button>
  ) : (
    <>
      <RedoIcon
        strokeWidth={0.2}
        className="absolute top-4 right-20 size-50 translate-y-20 -rotate-180 scale-x-0 scale-y-75 text-primary opacity-0 transition-all delay-500 duration-500 group-hover/workspace:translate-y-0 group-hover/workspace:rotate-[-130deg] group-hover/workspace:scale-x-100 group-hover/workspace:opacity-100 lg:right-36"
      />
      <p className="inline-flex gap-1 opacity-0 transition-opacity duration-500 group-hover/workspace:opacity-100">
        <span>{t('c:click')}</span>
        <span className="text-primary max-md:hidden xl:hidden">{`+ ${t('c:add')}`}</span>
        <span className="text-primary max-xl:hidden">{`+ ${t('c:add_resource', { resource: t('c:project').toLowerCase() })}`}</span>
        <span>{t('c:no_projects.text')}</span>
      </p>
    </>
  );

  return (
    <div data-board-empty>
      <ContentPlaceholder
        className="h-[calc(100vh-4rem-4rem)] md:h-[calc(100vh-4.88rem)]"
        icon={BirdIcon}
        title="c:no_resource_yet"
        titleProps={{ resource: t('c:project_other').toLowerCase() }}
      >
        <div className="max-md:mt-4">
          {workspace && !publicView ? (
            <AvailableProjectsEmptyAction workspace={workspace} fallback={createProjectAction} />
          ) : (
            createProjectAction
          )}
        </div>
      </ContentPlaceholder>
    </div>
  );
}
