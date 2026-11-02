import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { labelTileReveal } from '~/modules/label/label-tile-reveal';
import type { LabelRow } from '~/modules/label/types';
import { useLabelStatusCounts } from '~/modules/label/use-label-usage';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { statusOptions, TaskStatus } from '~/modules/task/task-properties';
import { cn } from '~/utils/cn';
import { formatCount } from '~/utils/format-count';

// The fills of the status icons. Their started and backlog icons draw in the text color, so those two get slate steps that stay apart.
const statusBarClass: Record<TaskStatus, string> = {
  [TaskStatus.Accepted]: 'bg-[#16A34A]',
  [TaskStatus.Reviewed]: 'bg-[#f97316]',
  [TaskStatus.Finished]: 'bg-[#97C022]',
  [TaskStatus.Started]: 'bg-slate-500 dark:bg-slate-400',
  [TaskStatus.Unstarted]: 'bg-slate-300 dark:bg-slate-600',
  [TaskStatus.Iced]: 'bg-[#1398E9]',
};

const boardStatusOrder = [...statusOptions].reverse();

const rollTransition = { ...labelTileReveal.transition, opacity: { duration: 0.18, ease: 'linear' } } as const;

interface LabelStatusBarsProps {
  row: LabelRow;
  /** On a workspace: each project's avatar beside its bar. */
  showProjects?: boolean;
}

/**
 * Per project, a bar of the label's tasks in each status, in the order of a project's panels. Bars share one scale, so a shorter bar means fewer tasks. A hover names a
 * segment's count, for a pointer; a press lists them all, for touch and keyboard, and on a workspace rolls the bar into the project's name. The count beside a bar is its
 * open tasks under the board search.
 */
export function LabelStatusBars({ row, showProjects }: LabelStatusBarsProps) {
  const { t } = useTranslation();
  const counts = useLabelStatusCounts(row);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);

  const bars = row.projectIds
    .map((projectId) => {
      const projectCounts = counts[projectId] ?? {};
      const statuses = boardStatusOrder
        .filter(({ value }) => projectCounts[value])
        .map((option) => ({ ...option, count: projectCounts[option.value] ?? 0 }));
      return { projectId, statuses, total: statuses.reduce((sum, { count }) => sum + count, 0) };
    })
    .sort((a, b) => b.total - a.total);
  const biggest = bars[0]?.total ?? 0;

  if (!biggest) return null;

  return (
    <ul aria-label={t('c:status')} className="flex flex-col">
      {bars.map(({ projectId, statuses, total }) => {
        const project = showProjects ? findProjectByIdOrSlug(projectId, row.tenantId) : undefined;
        const isOpen = openProjectId === projectId;

        return (
          <li key={projectId}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenProjectId(isOpen ? null : projectId)}
              className="group-[:not(:hover,:focus-within)]/label-tile:resting-avatar flex h-7 w-full items-center gap-2 rounded-sm outline-0 focus-visible:ring-2 focus-visible:ring-ring max-sm:h-11"
            >
              {project ? (
                <EntityAvatar type="project" id={project.id} name={project.name} url={project.thumbnailUrl} className="size-5 shrink-0" />
              ) : (
                <span className="sr-only">{t('c:status')}</span>
              )}
              <span className="relative h-full min-w-0 grow overflow-hidden">
                <motion.span
                  initial={false}
                  animate={isOpen && project ? { y: '-100%', opacity: 0 } : { y: 0, opacity: 1 }}
                  transition={rollTransition}
                  className="absolute inset-0 flex items-center"
                >
                  <span className="flex h-full items-center gap-px" style={{ width: `${(total / biggest) * 100}%` }}>
                    {statuses.map(({ value, status, count }, index) => (
                      <TooltipButton
                        key={value}
                        toolTipContent={`${project ? `${project.name}: ` : ''}${t(`c:${status}`)} ${formatCount(count)}`}
                        side="top"
                        sideOffset={0}
                      >
                        <span className="flex h-full min-w-px basis-0 items-center" style={{ flexGrow: count }}>
                          <span
                            className={cn(
                              'h-1.5 w-full',
                              index === 0 && 'rounded-l-full',
                              index === statuses.length - 1 && 'rounded-r-full',
                              statusBarClass[value],
                            )}
                          />
                        </span>
                      </TooltipButton>
                    ))}
                  </span>
                </motion.span>
                {project && (
                  <motion.span
                    initial={false}
                    animate={isOpen ? { y: 0, opacity: 1 } : { y: '100%', opacity: 0 }}
                    transition={rollTransition}
                    className="absolute inset-0 flex items-center text-left font-medium text-xs"
                  >
                    <span className="truncate">{project.name}</span>
                  </motion.span>
                )}
              </span>
              <span className="min-w-8 shrink-0 text-right text-muted-foreground text-xs tabular-nums">
                {formatCount(row.projectUsage[projectId] ?? 0)}
              </span>
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div key="counts" {...labelTileReveal}>
                  <ul className="grid grid-cols-2 gap-x-6 gap-y-1 pt-0.5 pb-2 text-xs tabular-nums">
                    {statuses.map(({ value, status, icon: Icon, count }) => (
                      <li key={value} className="flex items-center gap-1.5">
                        <Icon className="size-3.5 shrink-0" />
                        <span className="grow truncate text-muted-foreground">{t(`c:${status}`)}</span>
                        {formatCount(count)}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
