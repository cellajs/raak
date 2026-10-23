import type { ReactNode } from 'react';
import type { GetPublicProjectResponse } from 'sdk';
import { PageHeader } from '~/modules/common/page/header';
import { TaskSheetHandler } from '~/modules/task/task-sheet-handler';

interface PublicProjectPageProps {
  project: GetPublicProjectResponse;
  children: ReactNode;
}

export function PublicProjectPage({ project, children }: PublicProjectPageProps) {
  return (
    <>
      <TaskSheetHandler />
      <PageHeader entity={project} canUpdate={false} onCoverUpdate={() => {}} />
      <div className="flex flex-col sm:gap-2 sm:p-3 md:gap-3">{children}</div>
    </>
  );
}
