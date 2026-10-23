import { ListFilterIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { TooltipButton } from '~/modules/common/tooltip-button';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

interface LabelFilterButtonProps {
  name: string;
  onToggle?: () => void;
}

/** Toggles the board search `=name` to highlight this label's tasks. */
export function LabelFilterButton({ name, onToggle }: LabelFilterButtonProps) {
  const { t } = useTranslation();
  const { search, setSearch } = useSearchParams<{ q?: string }>({});
  const isActive = search.q === `=${name}`;

  return (
    <TooltipButton toolTipContent={t('c:filter_by_resource', { resource: name })} side="top" sideOffset={5}>
      <Button
        variant="ghost"
        size="xs"
        aria-pressed={isActive}
        onClick={() => {
          setSearch({ q: isActive ? '' : `=${name}` });
          onToggle?.();
        }}
        className={cn('size-8 opacity-60 hover:opacity-100', isActive && 'text-primary opacity-100')}
      >
        <ListFilterIcon />
      </Button>
    </TooltipButton>
  );
}
