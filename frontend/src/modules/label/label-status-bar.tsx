import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { EntityAvatar } from '~/modules/common/entity-avatar';
import type { LabelRow } from '~/modules/label/types';
import { useLabelStatusCounts } from '~/modules/label/use-label-usage';
import { findProjectByIdOrSlug } from '~/modules/project/query';
import { toggleLabelStatusFilter } from '~/modules/task/helpers/board-navigation';
import { statusOptions, statusOptionsByValue, TaskStatus } from '~/modules/task/task-properties';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/modules/ui/tooltip';
import { cn } from '~/utils/cn';
import { formatCount } from '~/utils/format-count';

// The fills of the status icons. Their started and backlog icons draw in the text color, so those two get slate steps that stay apart.
const statusBarClass: Record<TaskStatus, string> = {
  [TaskStatus.Accepted]: 'bg-[#16a34a] dark:bg-[#22c55e]',
  [TaskStatus.Reviewed]: 'bg-[#ea580c] dark:bg-[#f97316]',
  [TaskStatus.Finished]: 'bg-[#ca8a04] dark:bg-[#eab308]',
  [TaskStatus.Started]: 'bg-slate-500 dark:bg-slate-400',
  [TaskStatus.Unstarted]: 'bg-slate-300 dark:bg-slate-600',
  [TaskStatus.Iced]: 'bg-[#0284c7] dark:bg-[#0ea5e9]',
};

const boardStatusOrder = [...statusOptions].reverse();
const acceptedStatus = statusOptionsByValue[TaskStatus.Accepted].status;

interface LabelStatusBarProps {
  row: LabelRow;
  /** On a workspace: each project's avatar and count in a segment's tooltip. */
  showProjects?: boolean;
  onAction?: () => void;
}

/**
 * The label's tasks per status over all its projects, in the order of a project's panels. A segment puts the label and its status in the board search, a second press
 * takes the status out again. Accepted tasks show only when the search asks for them, as in the label's count. The rest of the search leaves the bar whole, so its
 * segments stay there to press.
 */
export function LabelStatusBar({ row, showProjects, onAction }: LabelStatusBarProps) {
  const { t } = useTranslation();
  const counts = useLabelStatusCounts(row);
  const isLabelFiltered = useSearch({ strict: false, select: (search) => !!search.labels?.includes(row.slug) });
  // Another route's `status` is a single value
  const statusFilter = useSearch({ strict: false, select: (search) => (Array.isArray(search.status) ? search.status.join() : '') });
  const filteredStatuses = statusFilter ? statusFilter.split(',') : [];

  const segments = boardStatusOrder
    .filter(({ status }) => status !== acceptedStatus || filteredStatuses.includes(acceptedStatus))
    .map((option) => {
      const projects = row.projectIds
        .map((projectId) => ({ projectId, count: counts[projectId]?.[option.value] ?? 0 }))
        .filter(({ count }) => count)
        .sort((a, b) => b.count - a.count);
      return { ...option, projects, count: projects.reduce((sum, { count }) => sum + count, 0) };
    })
    .filter(({ count }) => count);

  if (!segments.length) return null;

  const showsProjects = showProjects && row.projectIds.length > 1;

  return (
    // A hovered segment keeps its fill and the others fade; a touch would leave the hover stuck
    <ul aria-label={t('c:status')} className="flex gap-0.5 pointer-fine:[&:has(button:hover)_button:not(:hover)>span]:opacity-30">
      {segments.map(({ value, status, name, count, projects }, index) => {
        const isPressed = isLabelFiltered && filteredStatuses.includes(status);
        const isDimmed = isLabelFiltered && filteredStatuses.length > 0 && !isPressed;

        return (
          <li key={value} style={{ flexGrow: count }} className="flex min-w-1 basis-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={isPressed}
                    aria-label={`${t('c:filter_by_resource', { resource: `${row.name}, ${t(`c:${name}`)}` })} (${formatCount(count)})`}
                    onClick={() => {
                      toggleLabelStatusFilter(row.slug, status);
                      onAction?.();
                    }}
                    className="group/segment focus-visible:ring-ring flex h-7 w-full items-center rounded-sm outline-0 focus-visible:ring-2 max-sm:h-11"
                  >
                    <span
                      className={cn(
                        'h-3 w-full transition-opacity duration-150 group-hover/segment:opacity-100',
                        index === 0 && 'rounded-l-full',
                        index === segments.length - 1 && 'rounded-r-full',
                        isDimmed && 'opacity-30',
                        statusBarClass[value],
                      )}
                    />
                  </button>
                }
              />
              <TooltipContent side="top" sideOffset={0}>
                <span className="flex justify-between gap-4 tabular-nums">
                  {t(`c:${name}`)}
                  <span className="font-semibold">{formatCount(count)}</span>
                </span>
                {showsProjects && (
                  <span className="mt-1 flex gap-2.5 tabular-nums">
                    {projects.map(({ projectId, count: projectCount }) => {
                      const project = findProjectByIdOrSlug(projectId, row.tenantId);
                      return (
                        <span key={projectId} className="flex items-center gap-1">
                          {project && (
                            <EntityAvatar type="project" id={project.id} name={project.name} url={project.thumbnailUrl} className="size-4" />
                          )}
                          {formatCount(projectCount)}
                        </span>
                      );
                    })}
                  </span>
                )}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
