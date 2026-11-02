import { useSearch } from '@tanstack/react-router';
import { ListFilterIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { toggleLabelFilter } from '~/modules/task/helpers/board-navigation';
import { filterValues } from '~/modules/task/helpers/search-filter';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

interface LabelFilterButtonProps {
  name: string;
  slug: string;
  onAction?: () => void;
  className?: string;
}

/** Puts a label in the board search or takes it out. */
export function LabelFilterButton({ name, slug, onAction, className }: LabelFilterButtonProps) {
  const { t } = useTranslation();
  const isPressed = useSearch({ strict: false, select: (search) => filterValues(search.labels).includes(slug) });

  return (
    <TooltipButton toolTipContent={t('c:filter_by_resource', { resource: name })} side="top" sideOffset={5}>
      <Button
        variant="ghost"
        size="xs"
        aria-pressed={isPressed}
        onClick={() => {
          toggleLabelFilter(slug);
          onAction?.();
        }}
        className={cn(
          isPressed && 'bg-foreground-soft text-background hover:bg-foreground-soft hover:text-background dark:hover:bg-foreground-soft',
          className,
        )}
      >
        <ListFilterIcon />
      </Button>
    </TooltipButton>
  );
}
