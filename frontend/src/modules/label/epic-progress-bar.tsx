import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { type EpicPart, type EpicProgress, epicDonePercent, epicPartStatusIds, epicParts, epicTotal } from '~/modules/label/epic-progress';
import { isLabelStatusSearch, replaceWithLabelStatusSearch } from '~/modules/task/helpers/board-navigation';
import { epicProgressColors } from '~/modules/task/task-styles';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/modules/ui/tooltip';
import { cn } from '~/utils/cn';
import { formatCount } from '~/utils/format-count';

// The tint's steps at full strength; To do is the empty track the tint leaves bare
const partClass: Record<EpicPart, string> = {
  toDo: 'border-input border-[1.5px] text-muted-foreground',
  inProgress: epicProgressColors.inProgress.fill,
  done: epicProgressColors.done.fill,
};

// A part narrower than this share of the bar leaves its number out, which would not fit
const numberMinShare = 0.09;

interface EpicProgressBarProps {
  slug: string;
  progress: EpicProgress;
  onAction?: () => void;
}

/** An open epic's To do, In progress and Done, with Done at the end where the closed tile's tint starts. A press makes the board search exactly this epic and that part. */
export function EpicProgressBar({ slug, progress, onAction }: EpicProgressBarProps) {
  const { t } = useTranslation();
  const pressed = useSearch({
    strict: false,
    select: (search) => epicParts.find(({ part }) => isLabelStatusSearch(search, slug, epicPartStatusIds(part)))?.part ?? null,
  });

  const total = epicTotal(progress);
  if (!total) return null;
  const parts = epicParts.filter(({ part }) => progress[part] > 0);

  return (
    <div className="flex items-center gap-2.5">
      {/* A hovered part keeps its fill and the others fade; a touch would leave the hover stuck */}
      <ul aria-label={t('c:status')} className="flex min-w-0 grow gap-0.5 pointer-fine:[&:has(button:hover)_button:not(:hover)>span]:opacity-30">
        {parts.map(({ part, title }, index) => {
          const count = progress[part];
          const filterLabel = t('c:filter_epic_part', { part: t(title) });
          return (
            <li key={part} style={{ flexGrow: count }} className="flex min-w-1.5 basis-0">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      aria-pressed={pressed === part}
                      aria-label={`${filterLabel} (${formatCount(count)})`}
                      onClick={() => {
                        replaceWithLabelStatusSearch(slug, epicPartStatusIds(part));
                        onAction?.();
                      }}
                      className="group/part focus-visible:ring-ring flex h-7 w-full items-center rounded-sm outline-0 focus-visible:ring-2 max-sm:h-11"
                    >
                      <span
                        className={cn(
                          'flex h-5.5 w-full items-center justify-center overflow-hidden text-xs font-semibold tabular-nums transition-opacity duration-150 group-hover/part:opacity-100',
                          index === 0 && 'rounded-l-full',
                          index === parts.length - 1 && 'rounded-r-full',
                          pressed && pressed !== part && 'opacity-30',
                          partClass[part],
                        )}
                      >
                        {count / total >= numberMinShare && formatCount(count)}
                      </span>
                    </button>
                  }
                />
                <TooltipContent side="top" sideOffset={0}>
                  {filterLabel}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ul>
      <span className="shrink-0 text-xs font-semibold tabular-nums">{epicDonePercent(progress)}%</span>
    </div>
  );
}
