import { useMatchRoute } from '@tanstack/react-router';
import { PalmtreeIcon, SearchIcon, UndoIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { useReadOnlyHide } from '~/modules/task/hooks/use-read-only';

export const TaskPanelEmpty = ({ projectId }: { projectId?: string }) => {
  const { t } = useTranslation();

  const matchRoute = useMatchRoute();
  const isInWorkspace = matchRoute({ to: '/$tenantId/$organizationSlug/workspace/$slug', fuzzy: true });
  const readOnlyHide = useReadOnlyHide(projectId);

  return (
    <>
      <ContentPlaceholder
        className="group/empty min-h-[60vh] group-data-[search=true]/panel:hidden"
        icon={PalmtreeIcon}
        title="c:no_resource_yet"
        titleProps={{ resource: t('c:task_other').toLowerCase() }}
      >
        {isInWorkspace && (
          <>
            <UndoIcon
              strokeWidth={0.2}
              className={`absolute top-4 right-4 size-50 translate-y-20 rotate-180 scale-x-0 scale-y-75 text-primary opacity-0 transition-all delay-500 duration-500 group-hover/empty:translate-y-0 group-hover/empty:rotate-[130deg] group-hover/empty:scale-x-100 group-hover/empty:opacity-100 max-md:hidden ${readOnlyHide}`}
            />
            <p
              className={`inline-flex gap-1 transition-opacity duration-500 group-hover/empty:opacity-100 sm:opacity-0 ${readOnlyHide}`}
            >
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
        titleProps={{ resource: t('c:task_other').toLowerCase() }}
      />
    </>
  );
};
