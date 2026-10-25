import { EyeOffIcon, HighlighterIcon, ListFilterIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { IconComponent } from '~/modules/common/icons/types';
import { TooltipButton } from '~/modules/common/tooltip-button';
import type { LabelAction } from '~/modules/label/label-search';
import type { LabelRow } from '~/modules/label/types';
import { applyLabelAction } from '~/modules/task/helpers/board-navigation';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';
import { tw } from '~/utils/tw';

const labelActions = ['filter', 'highlight', 'hide'] as const satisfies LabelAction[];

export const labelActionIcons: Record<LabelAction, IconComponent> = { filter: ListFilterIcon, highlight: HighlighterIcon, hide: EyeOffIcon };

// Highlight shares the green of highlighted rows and cards
const pressedClass: Record<LabelAction, string> = {
  filter: tw('bg-accent text-primary'),
  highlight: tw('bg-green-300/30 text-green-700 hover:bg-green-300/40 dark:text-green-300'),
  hide: tw('bg-accent text-primary'),
};

interface LabelActionsProps {
  row: Pick<LabelRow, 'name' | 'slug'>;
  active: LabelAction | null;
  onAction?: () => void;
}

/** Filter, highlight and hide toggles of a label tile: one of them is pressed at most. */
export function LabelActions({ row, active, onAction }: LabelActionsProps) {
  const { t } = useTranslation();

  const tooltips: Record<LabelAction, string> = {
    filter: t('c:filter_by_resource', { resource: row.name }),
    highlight: t('c:highlight_resource', { resource: row.name }),
    hide: t(active === 'hide' ? 'c:show_resource' : 'c:hide_resource', { resource: row.name }),
  };

  return labelActions.map((action) => {
    const Icon = labelActionIcons[action];
    const isPressed = active === action;
    return (
      <TooltipButton key={action} toolTipContent={tooltips[action]} side="top" sideOffset={5}>
        <Button
          variant="ghost"
          size="xs"
          aria-pressed={isPressed}
          onClick={() => {
            applyLabelAction(row, action);
            onAction?.();
          }}
          className={cn('size-8 opacity-60 hover:opacity-100', isPressed && ['opacity-100', pressedClass[action]])}
        >
          <Icon />
        </Button>
      </TooltipButton>
    );
  });
}
