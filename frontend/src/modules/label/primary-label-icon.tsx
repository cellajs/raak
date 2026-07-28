import { TagIcon } from 'lucide-react';
import { SpriteIcon } from '~/modules/common/icons/sprite-icon';
import { isLabelColorToken, labelPalette } from '~/modules/label/label-palette';
import { cn } from '~/utils/cn';

interface PrimaryLabelIconProps {
  label?: { icon?: string | null; color?: string | null } | null;
  className?: string;
}

/** Icon of a primary label (task type): its lucide icon tinted by its palette token. */
export const PrimaryLabelIcon = ({ label, className }: PrimaryLabelIconProps) => {
  const colorClass = isLabelColorToken(label?.color) ? labelPalette[label.color].icon : undefined;
  if (!label?.icon) return <TagIcon className={cn('shrink-0', colorClass, className)} aria-hidden="true" />;
  return <SpriteIcon name={label.icon} className={cn('shrink-0', colorClass, className)} aria-hidden="true" />;
};
