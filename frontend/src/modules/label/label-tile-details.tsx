import { ChevronUpIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityChip } from '~/modules/common/entity-chip';
import { Spinner } from '~/modules/common/spinner';
import { useLabelUpdateMutation } from '~/modules/label/query';
import type { LabelRow } from '~/modules/label/types';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { Badge } from '~/modules/ui/badge';
import { Button } from '~/modules/ui/button';
import { Switch } from '~/modules/ui/switch';
import { lazyNamed } from '~/utils/lazy-named';

const LabelDescriptionForm = lazyNamed(() => import('~/modules/label/label-description-form'), 'LabelDescriptionForm');

// Past this, the last slot becomes the overflow toggle, so it never reads "+1"
const inlineProjectSlots = 3;

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
  canManage: boolean;
}

/** Body of an expanded tile: the epic switch, open tasks per project and, for epics, the description. */
export function LabelTileDetails({ row, canManage }: LabelTileDetailsProps) {
  const { t } = useTranslation();
  const updateLabel = useLabelUpdateMutation(row.tenantId, row.organizationId);

  const [showAllProjects, setShowAllProjects] = useState(false);

  const switchId = `epic-switch-${row.id}`;
  const projectListId = `label-projects-${row.id}`;
  const projects = row.projectIds.map((id) => findProjectByIdOrSlug(id, row.tenantId)).filter((project) => !!project);
  const overflows = projects.length > inlineProjectSlots;
  const inlineProjects = overflows ? projects.slice(0, inlineProjectSlots - 1) : projects;
  const hiddenCount = projects.length - inlineProjects.length;
  const projectListOpen = overflows && showAllProjects;

  const projectChip = (project: (typeof projects)[number]) => (
    <li key={project.id} title={project.name}>
      <EntityChip type="project" id={project.id} name={project.name} url={project.thumbnailUrl} className="bg-background text-xs">
        <span className="sr-only">{project.name} </span>
        <span className="text-muted-foreground tabular-nums">{row.projectUsage[project.id] ?? 0}</span>
      </EntityChip>
    </li>
  );

  return (
    <>
      <div className="flex flex-col gap-3 px-4 pb-3">
        <div className="flex items-center gap-2">
          {/* Promoting acts on this row only; same-slug siblings in other projects stay tags */}
          {canManage ? (
            <>
              <Switch
                id={switchId}
                checked={row.mode === 'epic'}
                onCheckedChange={(checked) => updateLabel.mutate({ id: row.id, ops: { mode: checked ? 'epic' : 'secondary' } })}
              />
              <label htmlFor={switchId} className="cursor-pointer select-none pl-1 text-sm leading-none">
                {t('c:epic')}
              </label>
            </>
          ) : (
            row.mode === 'epic' && <Badge variant="secondary">{t('c:epic')}</Badge>
          )}

          {projects.length > 0 && (
            <ul aria-label={t('c:project_other')} className="ml-auto flex shrink-0 items-center gap-1.5">
              {!projectListOpen && inlineProjects.map(projectChip)}
              {overflows && (
                <li>
                  <Button
                    type="button"
                    variant="outline"
                    size="micro"
                    aria-expanded={projectListOpen}
                    aria-controls={projectListId}
                    aria-label={projectListOpen ? t('c:show_less') : t('c:show_more', { count: hiddenCount })}
                    onClick={() => setShowAllProjects(!projectListOpen)}
                    className="min-w-6 px-1.5 text-muted-foreground tabular-nums"
                  >
                    {projectListOpen ? <ChevronUpIcon aria-hidden /> : `+${hiddenCount}`}
                  </Button>
                </li>
              )}
            </ul>
          )}
        </div>

        {projectListOpen && (
          <ul id={projectListId} aria-label={t('c:project_other')} className="flex flex-wrap gap-1.5">
            {projects.map(projectChip)}
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
