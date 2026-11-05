import { PanelTopCloseIcon, PanelTopOpenIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { PublicBadge } from '~/modules/project/public-badge';
import type { EnrichedProject } from '~/modules/project/types';
import { useProjectHeaderShown, useTaskBoardStore } from '~/modules/task/board/task-board-store';
import { Button } from '~/modules/ui/button';

interface ProjectHeaderToggleProps {
  project: EnrichedProject;
}

/** Shows or hides the project page's header. Hidden, the project's avatar holds the spot, with the expand icon over it on hover or focus. */
export function ProjectHeaderToggle({ project }: ProjectHeaderToggleProps) {
  const { t } = useTranslation();
  const isShown = useProjectHeaderShown(project.id);
  const setProjectHeaderShown = useTaskBoardStore((state) => state.setProjectHeaderShown);

  return (
    <TooltipButton toolTipContent={t(isShown ? 'c:hide_header' : 'c:show_header')} className="max-sm:hidden">
      <Button
        variant={isShown ? 'outline' : 'ghost'}
        size="icon"
        aria-expanded={isShown}
        aria-label={!isShown && project.public ? `${t('c:show_header')}. ${t('c:public_project')}` : undefined}
        className="group/header-toggle relative rounded-md p-0"
        onClick={() => setProjectHeaderShown(project.id, !isShown)}
      >
        {isShown ? (
          <PanelTopCloseIcon />
        ) : (
          <>
            <EntityAvatar id={project.id} type="project" name={project.name} url={project.thumbnailUrl} className="size-full" />
            <span className="bg-background/75 absolute inset-0 flex items-center justify-center rounded-md opacity-0 transition-opacity group-hover/header-toggle:opacity-100 group-focus-visible/header-toggle:opacity-100">
              <PanelTopOpenIcon />
            </span>
            {project.public && <PublicBadge />}
          </>
        )}
      </Button>
    </TooltipButton>
  );
}
