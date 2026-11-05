import { PalmtreeIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Project } from 'sdk';
import type { TKey } from '~/lib/i18n-locales';
import { ContentPlaceholder } from '~/modules/common/content-placeholder';
import { NewTaskButton } from '~/modules/task/board/new-task-button';
import { boardAcceptedCutOffDays } from '~/modules/task/task-properties';
import { useIsWorkspaceRoute } from '~/modules/workspace/use-workspace-context';

interface TaskPanelEmptyProps {
  project: Project;
  /** A short line in place of the full placeholder. */
  title?: TKey;
}

export function TaskPanelEmpty({ project, title }: TaskPanelEmptyProps) {
  const { t } = useTranslation();

  const isInWorkspace = useIsWorkspaceRoute();

  return (
    <>
      {title ? (
        <ContentPlaceholder
          size="sm"
          className="h-auto pt-8 group-data-[search=true]/panel:hidden"
          title={title}
          titleOptions={{ days: boardAcceptedCutOffDays }}
        />
      ) : (
        <ContentPlaceholder
          className="min-h-[60vh] group-data-[search=true]/panel:hidden md:h-[60vh]"
          icon={PalmtreeIcon}
          title="c:no_resource_yet"
          titleOptions={{ resource: t('c:task_other') }}
        >
          {isInWorkspace && <NewTaskButton project={project} size="default" />}
        </ContentPlaceholder>
      )}

      <ContentPlaceholder
        className="group-data-[search=false]/panel:hidden"
        title="c:no_resource_found"
        titleOptions={{ resource: t('c:task_other') }}
      />
    </>
  );
}
