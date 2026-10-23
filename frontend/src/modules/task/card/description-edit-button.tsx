import { useTranslation } from 'react-i18next';
import { cn } from '~/utils/cn';

interface DescriptionEditButtonProps {
  onClick: () => void;
  className: string;
}

/**
 * Keyboard way into the description editor, laid over the description and shown only as its focus ring. The pointer
 * passes through to the description, which a click edits already. `className` places it.
 */
export function DescriptionEditButton({ onClick, className }: DescriptionEditButtonProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      aria-label={t('c:edit_resource', { resource: t('c:description').toLowerCase() })}
      onClick={onClick}
      className={cn('focus-effect focus-inset pointer-events-none absolute rounded-md', className)}
    />
  );
}
