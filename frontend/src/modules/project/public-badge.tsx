import { GlobeIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import '~/modules/project/public-badge.css';

interface PublicBadgeProps {
  /** `lg` for the page header's avatar, `sm` for one inline with a title. */
  size?: 'sm' | 'md' | 'lg';
}

const iconClass = { sm: 'size-2.5', md: 'size-3.5', lg: 'size-4.25' };

/** The globe in a notch at a public project avatar's corner (public-badge.css): the avatar's sibling, hanging past it unclipped. */
export function PublicBadge({ size = 'md' }: PublicBadgeProps) {
  const { t } = useTranslation();

  return (
    <span
      role="img"
      aria-label={t('c:public_project')}
      data-public-badge={size}
      className="absolute flex items-center justify-center text-muted-foreground dark:text-foreground"
    >
      <GlobeIcon className={iconClass[size]} />
    </span>
  );
}
