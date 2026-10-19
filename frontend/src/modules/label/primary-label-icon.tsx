import { TagIcon } from 'lucide-react';
import { SpriteIcon } from '~/modules/common/icons/sprite-icon';
import { isLabelColorToken, labelPalette } from '~/modules/label/label-palette';
import { cn } from '~/utils/cn';

interface PrimaryLabelIconProps {
  label?: { icon?: string | null; color?: string | null } | null;
  className?: string;
}

/**
 * Icon of a primary label (task type): its lucide icon tinted by its palette token. The fill is
 * the stroke color faded to 20%, translucent so strokes drawn under a shape stay visible.
 */
export function PrimaryLabelIcon({ label, className }: PrimaryLabelIconProps) {
  const colorClass = isLabelColorToken(label?.color) ? labelPalette[label.color].icon : undefined;
  const iconClass = cn('shrink-0 fill-current/20', colorClass, className);
  if (!label?.icon) return <TagIcon className={iconClass} aria-hidden="true" />;
  return <SpriteIcon name={label.icon} className={iconClass} aria-hidden="true" />;
}
