import { ListFilterIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { toggleLabelFilter } from '~/modules/task/helpers/board-navigation';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

interface LabelFilterButtonProps {
  name: string;
  slug: string;
  isPressed: boolean;
  onAction?: () => void;
  className?: string;
}

/** Puts a label in the board search or takes it out; while pressed it stays in view on a resting tile. */
export function LabelFilterButton({ name, slug, isPressed, onAction, className }: LabelFilterButtonProps) {
  const { t } = useTranslation();

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
        className={cn('size-8', className, isPressed && 'translate-x-0 bg-accent text-primary opacity-100')}
      >
        <ListFilterIcon />
      </Button>
    </TooltipButton>
  );
}
