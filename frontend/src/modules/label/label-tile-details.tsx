import { LockIcon } from 'lucide-react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '~/modules/common/spinner';
import type { EpicProgress } from '~/modules/label/epic-progress';
import { EpicProgressBar } from '~/modules/label/epic-progress-bar';
import { EpicProjectLine } from '~/modules/label/epic-projects';
import type { LabelRow, LabelsHostProps } from '~/modules/label/types';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { lazyNamed } from '~/utils/lazy-named';

const LabelDescriptionForm = lazyNamed(() => import('~/modules/label/label-description-form'), 'LabelDescriptionForm');

interface LabelTileDetailsProps extends Pick<LabelsHostProps, 'onAction'> {
  row: LabelRow;
  progress: EpicProgress;
  lockedByProjectIds: string[];
  /** On a workspace: the projects a label can live in, for the epic's project picker. */
  scopeProjectIds?: string[];
}

/** Body of an open epic: its progress, its projects and Close as epic, then the description. Only an epic opens. */
export function LabelTileDetails({ row, progress, lockedByProjectIds, scopeProjectIds, onAction }: LabelTileDetailsProps) {
  const { t } = useTranslation();

  const isLocked = lockedByProjectIds.length > 0;
  const lockingProject = lockedByProjectIds.length === 1 ? findProjectByIdOrSlug(lockedByProjectIds[0], row.tenantId) : undefined;
  const lockReason =
    lockedByProjectIds.length === row.projectIds.length
      ? t('c:label_locked_all')
      : lockingProject
        ? t('c:label_locked_one', { project: lockingProject.name })
        : t('c:label_locked_many', { count: lockedByProjectIds.length });

  return (
    <>
      <div className="flex flex-col gap-2 px-4 pt-1 pb-2">
        {isLocked && (
          <p className="text-muted-foreground flex gap-2 text-xs">
            <LockIcon aria-hidden className="mt-px size-3.5 shrink-0" />
            {lockReason}
          </p>
        )}
        <EpicProgressBar slug={row.slug} progress={progress} onAction={onAction} />
        <EpicProjectLine row={row} isLocked={isLocked} scopeProjectIds={scopeProjectIds} />
      </div>
      <div className="border-t">
        <Suspense fallback={<Spinner className="my-6" noDelay />}>
          <LabelDescriptionForm label={row} isLocked={isLocked} />
        </Suspense>
      </div>
    </>
  );
}
