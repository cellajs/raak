import { Bird, Plus, Redo } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useBreakpoints } from '~/hooks/use-breakpoints';
import { createNewProject } from '~/modules/app/board/helpers';
import ContentPlaceholder from '~/modules/common/content-placeholder';
import { Button } from '~/modules/ui/button';

export function EmptyBoard() {
  const { t } = useTranslation();
  const isTablet = useBreakpoints('max', 'md');

  useEffect(() => {
    // remove add task button if no projects yet
    const navButton = document.getElementById('workspace-add-task');
    if (navButton) navButton.classList.add('hidden');
    return () => {
      if (navButton) navButton.classList.remove('hidden');
    };
  }, []);

  return (
    <ContentPlaceholder
      className="h-[calc(100vh-4rem-4rem)] md:h-[calc(100vh-4.88rem)]"
      Icon={Bird}
      title={t('common:no_resource_yet', { resource: t('app:projects').toLowerCase() })}
      textClassName="max-md:mt-4"
      text={
        isTablet ? (
          <Button variant="plain" onClick={createNewProject}>
            <Plus size={16} />
            <span>{`${t('common:add')} ${t('app:project').toLowerCase()}`}</span>
          </Button>
        ) : (
          <>
            <Redo
              size={200}
              strokeWidth={0.2}
              className="absolute scale-x-0 scale-y-75 -rotate-180 text-primary top-4 right-20 lg:right-36 translate-y-20 opacity-0 duration-500 delay-500 transition-all group-hover/workspace:opacity-100 group-hover/workspace:scale-x-100 group-hover/workspace:translate-y-0 group-hover/workspace:rotate-[-130deg]"
            />
            <p className="inline-flex gap-1 opacity-0 duration-500 transition-opacity group-hover/workspace:opacity-100 ">
              <span>{t('common:click')}</span>
              <span className="text-primary">{`+ ${t('common:add')}`}</span>
              <span>{t('app:no_projects.text')}</span>
            </p>
          </>
        )
      }
    />
  );
}
