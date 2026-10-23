import type { ReactNode } from 'react';
import { buttonVariants } from '~/modules/ui/button';
import { Kbd } from '~/modules/ui/kbd';
import { cn } from '~/utils/cn';
import { inNumbersArray } from '~/utils/in-numbers-array';
import { tw } from '~/utils/tw';

/** Action row ("Show all", "Create label"): filled in the mobile drawer, ghost from `sm` up. Wrap it in `p-1` to inset it with the list rows. */
export const comboboxActionButtonClass = cn(
  buttonVariants({ variant: 'secondary' }),
  'h-9 w-full justify-center gap-2',
  'sm:bg-transparent sm:shadow-none sm:hover:bg-accent sm:hover:text-accent-foreground dark:sm:hover:bg-accent/50',
);

/** Desktop: a height-capped flex column so only the list scrolls. Mobile: a plain block, since a nested scroll region fights the drawer's swipe. */
export const comboboxShellClass = tw('relative rounded-lg sm:flex sm:max-h-[44vh] sm:w-(--trigger-width) sm:flex-col sm:overflow-hidden');

/** Desktop only: fills the shell's remaining height. */
export const comboboxScrollClass = tw('sm:min-h-0 sm:flex-1');

/** Pins the search input in the mobile drawer; `top-5` clears the drawer's ~20px sticky drag handle. A normal flex child from `sm` up. */
export const comboboxInputPinClass = tw('sticky top-5 z-10 shrink-0 bg-background sm:static sm:top-auto sm:z-auto sm:bg-transparent');

/** Row of a task combobox list, on top of `ComboboxItem`'s base. */
export const comboboxRowClass = tw('h-9 rounded-md pr-2 leading-normal');

/** The item at the 1-based position a single-digit `value` names; undefined outside `options.max` (default `items.length`) or when disabled. */
export function matchDigitHotkey<T>(items: readonly T[], value: string, options?: { max?: number; enabled?: boolean }): T | undefined {
  const { max = items.length, enabled = true } = options ?? {};
  if (!enabled) return undefined;

  const limit = Math.min(items.length, max);
  if (!inNumbersArray(limit, value)) return undefined;

  return items[Number.parseInt(value, 10) - 1];
}

interface ComboboxHotkeyHintProps {
  searching: boolean;
  children: ReactNode;
}

/** Corner hint over the search input, hidden while `searching`. */
export function ComboboxHotkeyHint({ searching, children }: ComboboxHotkeyHintProps) {
  if (searching) return null;
  return <Kbd className="absolute top-2.5 right-2.5 max-sm:hidden">Alt {children}</Kbd>;
}

interface HotkeyIndexBadgeProps {
  index: number | undefined;
}

/** The item's 1-based hotkey position; pass `undefined` while searching or when digit hotkeys do not apply. */
export function HotkeyIndexBadge({ index }: HotkeyIndexBadgeProps) {
  if (index === undefined) return null;
  return <span className="mx-1 text-xs opacity-50 max-sm:hidden">{index + 1}</span>;
}
