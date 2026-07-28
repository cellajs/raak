import type { LucideProps } from 'lucide-react';
import { appConfig } from 'shared';
import { cn } from '~/utils/cn';

/** URL of the precached lucide symbol sprite (regenerate via `pnpm --filter frontend gen:icons`). */
const spriteUrl = '/static/icons/lucide-sprite.svg';

export interface SpriteIconProps extends Omit<LucideProps, 'size' | 'ref'> {
  /** Lucide icon name in kebab-case (e.g. 'star', 'bug'), as stored on entities. */
  name: string;
}

/**
 * Renders any lucide icon by name from the symbol sprite, for user-selected icons stored in
 * the database. Static imports from lucide-react stay the default for code-chosen icons.
 * The `lucide` class opts into the global icon defaults (rem-based size); stroke styling is
 * applied here since LucideProvider context does not reach sprite symbols.
 */
export const SpriteIcon = ({ name, className, strokeWidth, ...props }: SpriteIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth ?? appConfig.theme.strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    role="img"
    aria-label={name}
    className={cn('lucide', className)}
    {...props}
  >
    <use href={`${spriteUrl}#${name}`} />
  </svg>
);
