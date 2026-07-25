import { ListFilterIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from '~/hooks/use-search-params';
import { Button } from '~/modules/ui/button';
import { cn } from '~/utils/cn';

/**
 * Filter-by-label toggle over the shared board search: setting the search `q` to a label's
 * name filters tasks (backend matches label names into an array-overlap filter) and the
 * labels panel simultaneously. Toggling the same name again clears the filter.
 */
export const useLabelFilterToggle = () => {
  const { search, setSearch } = useSearchParams<{ q?: string }>({});
  const activeFilter = search.q ?? '';

  return {
    activeFilter,
    isActive: (name: string) => activeFilter === name,
    toggle: (name: string) => setSearch({ q: activeFilter === name ? '' : name }),
  };
};

interface LabelFilterButtonProps {
  name: string;
  size?: 'xs' | 'icon';
  tabIndex?: number;
  className?: string;
}

/** Toggle button for filtering the board by a label's name (table column + label page). */
export const LabelFilterButton = ({ name, size = 'icon', tabIndex, className }: LabelFilterButtonProps) => {
  const { t } = useTranslation();
  const { isActive, toggle } = useLabelFilterToggle();

  return (
    <Button
      variant="ghost"
      size={size}
      tabIndex={tabIndex}
      aria-label={t('c:filter_by_resource', { resource: name })}
      aria-pressed={isActive(name)}
      onClick={() => toggle(name)}
      className={cn('opacity-60 hover:opacity-100', isActive(name) && 'text-primary opacity-100', className)}
    >
      <ListFilterIcon />
    </Button>
  );
};
