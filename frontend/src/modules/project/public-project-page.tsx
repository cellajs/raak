import type { ReactNode } from 'react';
import type { GetPublicProjectResponse } from 'sdk';
import { PageHeader } from '~/modules/common/page/header';
import { TaskSheetHandler } from '~/modules/task/task-sheet-handler';

export const PublicProjectPage = ({
  project,
  children,
}: {
  project: GetPublicProjectResponse;
  children: ReactNode;
}) => {
  return (
    <>
      <TaskSheetHandler />
      <PageHeader entity={project} canUpdate={false} coverUpdateCallback={() => {}} />
      <div className="group/project flex flex-col p-0 sm:gap-2 sm:p-3 md:gap-3">{children}</div>
    </>
  );
};
