import { PalmtreeIcon, SearchIcon, UndoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { useReadOnlyHide } from '~/modules/project/use-read-only';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';
import { cn } from '~/utils/cn';

interface TaskPanelEmptyProps {
  projectId?: string;
}

export function TaskPanelEmpty({ projectId }: TaskPanelEmptyProps) {
  const { t } = useTranslation();

  const isInWorkspace = useIsWorkspaceRoute();
  const readOnlyHide = useReadOnlyHide(projectId);

  return (
    <>
      {/* A size container needs a definite height: on min-height alone, Chromium resolves cqh and height queries to 0 */}
      <ContentPlaceholder
        className="group/empty md:@container-size min-h-[60vh] group-data-[search=true]/panel:hidden md:h-[60vh]"
        icon={PalmtreeIcon}
        title="c:no_resource_yet"
        titleOptions={{ resource: t('c:task_other') }}
      >
        {isInWorkspace && (
          <>
            {/* Sized by the placeholder's height, so its tail stays clear of the centered icon; too short a panel hides it */}
            <UndoIcon
              strokeWidth={0.2}
              className={cn(
                'absolute top-4 right-4 size-[min(12.5rem,68cqh_-_7.5rem)] translate-y-20 rotate-180 scale-x-0 scale-y-75 text-primary opacity-0 transition-[opacity,translate,rotate,scale] delay-500 duration-500 group-hover/empty:translate-y-0 group-hover/empty:rotate-130 group-hover/empty:scale-x-100 group-hover/empty:opacity-100 max-md:hidden [@container(max-height:18.5rem)]:hidden',
                readOnlyHide,
              )}
            />
            <p className={cn('inline-flex gap-1 transition-opacity duration-500 group-hover/empty:opacity-100 sm:opacity-0', readOnlyHide)}>
              <span>{t('c:click')}</span>
              <span className="text-primary">+</span>
              <span className="text-primary max-sm:hidden">{t('c:task')}</span>
              <span>{t('c:no_tasks.text')}</span>
            </p>
          </>
        )}
      </ContentPlaceholder>

      <ContentPlaceholder
        className="group-data-[search=false]/panel:hidden"
        icon={SearchIcon}
        title="c:no_resource_found"
        titleOptions={{ resource: t('c:task_other') }}
      />
    </>
  );
}
