import { BirdIcon, PlusIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { createNewProject } from '~/modules/project/project-actions';
import { Button } from '~/modules/ui/button';

export function BoardEmpty() {
  const { t } = useTranslation();

  return (
    <div data-board-empty>
      <ContentPlaceholder
        className="h-[calc(100vh-var(--board-mobile-offset))] md:h-[calc(100vh-var(--board-offset-md))]"
        icon={BirdIcon}
        title="c:no_resource_yet"
        titleOptions={{ resource: t('c:project_other') }}
      >
        <div className="max-md:mt-4">
          <Button variant="secondary" onClick={createNewProject}>
            <PlusIcon />
            <span>{t('c:add_resource', { resource: t('c:project') })}</span>
          </Button>
        </div>
      </ContentPlaceholder>
    </div>
  );
}
