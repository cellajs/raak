import { useTranslation } from 'react-i18next';
import { cn } from '~/utils/cn';

interface NoAssigneeAvatarProps {
  className?: string;
  'aria-hidden'?: boolean;
}

/** No one assigned: an avatar at rest holding a question mark, sized by the caller like the avatars beside it. */
export function NoAssigneeAvatar({ className, 'aria-hidden': ariaHidden }: NoAssigneeAvatarProps) {
  const { t } = useTranslation();
  return (
    <span
      role={ariaHidden ? undefined : 'img'}
      aria-label={ariaHidden ? undefined : t('c:no_one')}
      aria-hidden={ariaHidden}
      // The container sizes the mark, as an avatar's letter scales with it
      className={cn(
        '@container inline-flex shrink-0 items-center justify-center rounded-full bg-(--avatar-rest) font-semibold text-(--avatar-rest-foreground) leading-none',
        className,
      )}
    >
      <span className="text-[50cqi]">?</span>
    </span>
  );
}
