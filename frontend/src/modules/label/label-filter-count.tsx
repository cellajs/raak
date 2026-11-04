import { useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { toggleLabelFilter } from '~/modules/task/helpers/board-navigation';
import { filterValues } from '~/modules/task/helpers/search-filter';
import { cn } from '~/utils/cn';
import { formatCount } from '~/utils/format-count';

interface LabelFilterCountProps {
  name: string;
  slug: string;
  count: number;
  onAction?: () => void;
  className?: string;
}

/** A label's task count, which puts the label in the board search or takes it out. */
export function LabelFilterCount({ name, slug, count, onAction, className }: LabelFilterCountProps) {
  const { t } = useTranslation();
  const isPressed = useSearch({ strict: false, select: (search) => filterValues(search.labels).includes(slug) });
  return (
    <TooltipButton toolTipContent={t('c:filter')} side="top" sideOffset={5}>
      <button
        type="button"
        aria-pressed={isPressed}
        aria-label={`${t('c:filter_by_resource', { resource: name })} (${formatCount(count)})`}
        onClick={() => {
          toggleLabelFilter(slug);
          onAction?.();
        }}
        className={cn(
          'focus-effect relative z-1 h-6 shrink-0 whitespace-nowrap rounded-full px-1.5 text-muted-foreground text-xs tabular-nums transition-colors hover:bg-foreground/7 hover:text-foreground',
          isPressed && 'bg-foreground-soft text-background hover:bg-foreground-soft hover:text-background',
          className,
        )}
      >
        {formatCount(count)}
      </button>
    </TooltipButton>
  );
}
