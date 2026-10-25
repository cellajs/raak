import { useSearch } from '@tanstack/react-router';
import { EyeOffIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { parseHiddenLabels } from '~/modules/label/label-search';
import { showHiddenLabels } from '~/modules/task/helpers/board-navigation';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

/** Board header button while labels are hidden, also from a shared link or with the labels panel closed: a click shows their tasks again. */
export function HiddenLabelsButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const count = useSearch({ strict: false, select: (search) => parseHiddenLabels(search.hide).length });
  if (!count) return null;

  const label = t('c:show_hidden_labels', { count });
  return (
    <TooltipButton toolTipContent={label}>
      <Button variant="ghost" aria-label={label} className={cn('gap-1.5 px-2.5', className)} onClick={showHiddenLabels}>
        <EyeOffIcon />
        <span className="tabular-nums">{count}</span>
      </Button>
    </TooltipButton>
  );
}
