import { useTranslation } from 'react-i18next';
import { Badge } from '~/modules/ui/badge';
import { cn } from '~/utils/cn';

/** Marks a sample project, or a person of the sample team. */
export function SampleBadge({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <Badge soft className={cn('text-xs font-normal', className)}>
      {t('c:sample')}
    </Badge>
  );
}
