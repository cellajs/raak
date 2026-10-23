import { TagIcon } from 'lucide-react';
import { NamedIcon } from '~/modules/common/icons/named-icon';
import { isLabelColorToken, labelPalette } from '~/modules/label/label-palette';
import { cn } from '~/utils/cn';

interface PrimaryLabelIconProps {
  label?: { icon?: string | null; color?: string | null } | null;
  className?: string;
}

/** The fill is the stroke color at 20%, translucent so strokes drawn under a shape stay visible. */
export function PrimaryLabelIcon({ label, className }: PrimaryLabelIconProps) {
  const colorClass = isLabelColorToken(label?.color) ? labelPalette[label.color].icon : undefined;
  const iconClass = cn('shrink-0 fill-current/20', colorClass, className);
  if (!label?.icon) return <TagIcon className={iconClass} />;
  return <NamedIcon name={label.icon} className={iconClass} aria-hidden="true" />;
}
