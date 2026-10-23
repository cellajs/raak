import { AnimatePresence, motion } from 'motion/react';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrganizationLayoutContext } from '~/hooks/use-route-context';
import { EntityChip } from '~/modules/common/entity-chip';
import { Spinner } from '~/modules/common/spinner';
import { useLabelUpdateMutation } from '~/modules/label/query';
import type { LabelRow } from '~/modules/label/types';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { Badge } from '~/modules/ui/badge';
import { Switch } from '~/modules/ui/switch';
import { cn } from '~/utils/cn';
import { lazyNamed } from '~/utils/lazy-named';

const LabelDescriptionForm = lazyNamed(() => import('~/modules/label/label-description-form'), 'LabelDescriptionForm');

/** Height-and-fade reveal shared by a tile's body and its epic description. */
export const labelTileReveal = {
  initial: { height: 0, opacity: 0, overflow: 'hidden' },
  // Visible once open, so the description editor's menus are not clipped
  animate: { height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } },
  exit: { height: 0, opacity: 0, overflow: 'hidden' },
  transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] },
} as const;

interface LabelTileDetailsProps {
  row: LabelRow;
  /** Aligns the body with the name when a selection checkbox precedes it. */
  indented: boolean;
  canManage: boolean;
}

/**
 * Body of an expanded label tile: the tag/epic switch for members, open tasks per project and,
 * for epics, the collaborative description.
 */
export function LabelTileDetails({ row, indented, canManage }: LabelTileDetailsProps) {
  const { t } = useTranslation();
  const { organizationId, tenantId } = useOrganizationLayoutContext();
  const updateLabel = useLabelUpdateMutation(tenantId, organizationId);

  const switchId = `epic-switch-${row.id}`;
  const projects = row.projectIds.map((id) => findProjectByIdOrSlug(id, tenantId)).filter((project) => !!project);

  return (
    <>
      <div className={cn('flex flex-col gap-3 pr-4 pb-3', indented ? 'pl-11' : 'pl-4')}>
        {/* Promoting acts on this row only; same-slug siblings in other projects stay tags. Read-only viewers get the badge
            the collapsed tile shows. */}
        {canManage ? (
          <div className="flex items-center gap-2">
            <Switch
              id={switchId}
              checked={row.mode === 'epic'}
              onCheckedChange={(checked) => updateLabel.mutate({ id: row.id, ops: { mode: checked ? 'epic' : 'secondary' } })}
              aria-label={t('c:epic')}
            />
            <label htmlFor={switchId} className="cursor-pointer select-none pl-1 text-sm leading-none">
              {t('c:epic')}
            </label>
          </div>
        ) : (
          row.mode === 'epic' && (
            <Badge variant="secondary" className="self-start">
              {t('c:epic')}
            </Badge>
          )
        )}

        {projects.length > 0 && (
          <ul aria-label={t('c:project_other')} className="flex flex-wrap gap-1.5">
            {projects.map((project) => (
              <li key={project.id} className="min-w-0">
                <EntityChip
                  type="project"
                  id={project.id}
                  name={project.name}
                  url={project.thumbnailUrl}
                  className="max-w-48 bg-background text-xs"
                  end={<span className="text-muted-foreground tabular-nums">{row.projectUsage[project.id] ?? 0}</span>}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <AnimatePresence initial={false}>
        {row.mode === 'epic' && (
          <motion.div key="description" {...labelTileReveal} className="border-t">
            <Suspense fallback={<Spinner className="my-6" noDelay />}>
              <LabelDescriptionForm label={row} />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
