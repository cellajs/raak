import { LockIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '~/modules/common/spinner';
import { LabelStatusBars } from '~/modules/label/label-status-bars';
import { labelTileReveal } from '~/modules/label/label-tile-reveal';
import { useLabelUpdateMutation } from '~/modules/label/query';
import type { LabelRow } from '~/modules/label/types';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { Switch } from '~/modules/ui/switch';
import { cn } from '~/utils/cn';
import { lazyNamed } from '~/utils/lazy-named';

const LabelDescriptionForm = lazyNamed(() => import('~/modules/label/label-description-form'), 'LabelDescriptionForm');

interface LabelTileDetailsProps {
  row: LabelRow;
  lockedByProjectIds: string[];
  showProjectUsage?: boolean;
}

/** Body of an expanded tile: the epic switch, its tasks per status and, for epics, the description. */
export function LabelTileDetails({ row, lockedByProjectIds, showProjectUsage }: LabelTileDetailsProps) {
  const { t } = useTranslation();
  const updateLabel = useLabelUpdateMutation(row.tenantId, row.organizationId);

  const switchId = `epic-switch-${row.id}`;
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
      <div className="flex flex-col gap-3 px-4 pt-2 pb-3">
        <div className="flex items-center gap-2">
          {/* Promoting acts on this row only; same-slug siblings in other projects stay tags */}
          <Switch
            id={switchId}
            checked={row.mode === 'epic'}
            disabled={isLocked}
            onCheckedChange={(checked) => updateLabel.mutate({ id: row.id, ops: { mode: checked ? 'epic' : 'secondary' } })}
          />
          <label htmlFor={switchId} className={cn('pl-1 text-sm leading-none select-none', isLocked ? 'text-muted-foreground' : 'cursor-pointer')}>
            {t('c:epic')}
          </label>
        </div>

        {isLocked && (
          <p className="text-muted-foreground flex gap-2 text-xs">
            <LockIcon aria-hidden className="mt-px size-3.5 shrink-0" />
            {lockReason}
          </p>
        )}

        <LabelStatusBars row={row} showProjects={showProjectUsage} />
      </div>

      <AnimatePresence initial={false}>
        {row.mode === 'epic' && (
          <motion.div key="description" {...labelTileReveal} className="border-t">
            <Suspense fallback={<Spinner className="my-6" noDelay />}>
              <LabelDescriptionForm label={row} isLocked={isLocked} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
