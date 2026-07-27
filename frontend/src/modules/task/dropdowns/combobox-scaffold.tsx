import type { ReactNode } from 'react';
import { buttonVariants } from '~/modules/ui/button';
import { Kbd } from '~/modules/ui/kbd';
import { cn } from '~/utils/cn';
import { inNumbersArray } from '~/utils/in-numbers-array';

/**
 * Full-width styling for a combobox action row such as "Show all" or "Create label". Filled
 * secondary in the mobile drawer to match the drawer action buttons (`DropdownActionItem`), and a
 * lighter ghost look from `sm` up. Wrap the row in a `p-1` container so it insets in line with the
 * `ComboboxList` rows on both desktop and the mobile drawer.
 */
export const comboboxActionButtonClass = cn(
  buttonVariants({ variant: 'secondary' }),
  'h-9 w-full justify-center gap-2',
  // Desktop: drop the secondary fill for a ghost look; the mobile drawer keeps the filled button.
  'sm:bg-transparent sm:shadow-none sm:hover:bg-accent sm:hover:text-accent-foreground dark:sm:hover:bg-accent/50',
);

/**
 * Shell for an inline combobox dropdown. On desktop (`sm` and up) it is a bounded flex column that
 * caps the popover height and hands scrolling to its `ScrollArea` (see `comboboxScrollClass`), so the
 * search input can pin above the list. On mobile it stays a plain block: the surrounding drawer is
 * the single scroll container (its native touch scroll), and the input pins via `comboboxInputPinClass`.
 * A nested scroll region inside the drawer fights its swipe/touch handling, so we deliberately avoid one.
 */
export const comboboxShellClass =
  'relative rounded-lg sm:flex sm:max-h-[44vh] sm:w-(--trigger-width) sm:flex-col sm:overflow-hidden';

/** Scroll region inside `comboboxShellClass`. Desktop only: fills remaining height so only the list scrolls. */
export const comboboxScrollClass = 'sm:min-h-0 sm:flex-1';

/**
 * Pins a combobox search input inside the mobile drawer via `position: sticky` while the drawer scrolls,
 * with an opaque background so the list scrolls underneath it. `top-5` clears the drawer's ~20px sticky
 * drag handle. Reverts to a normal flex child on desktop, where the shell's `ScrollArea` does the scrolling.
 */
export const comboboxInputPinClass =
  'sticky top-5 z-10 shrink-0 bg-background sm:static sm:top-auto sm:z-auto sm:bg-transparent';

/**
 * Matches a single-digit combobox input value against the 1-based position of an item in `items`.
 * Capped at `options.max` (default: `items.length`); disabled entirely when `options.enabled` is false.
 * Returns the matched item, or `undefined` when `value` isn't an in-range digit.
 */
export function matchDigitHotkey<T>(
  items: readonly T[],
  value: string,
  options?: { max?: number; enabled?: boolean },
): T | undefined {
  const { max = items.length, enabled = true } = options ?? {};
  if (!enabled) return undefined;

  const limit = Math.min(items.length, max);
  if (!inNumbersArray(limit, value)) return undefined;

  return items[Number.parseInt(value, 10) - 1];
}

/**
 * Corner hotkey hint rendered over a combobox's search input. Hidden while `searching` (and, via
 * `Kbd` itself, below the `xs` breakpoint).
 */
export function ComboboxHotkeyHint({ searching, children }: { searching: boolean; children: ReactNode }) {
  if (searching) return null;
  return <Kbd className="absolute top-2.5 right-2.5 max-sm:hidden">{children}</Kbd>;
}

/**
 * Numbered hint badge for a combobox item's 1-based hotkey position. Pass `undefined` for `index`
 * to hide it, e.g. while searching or once digit hotkeys no longer apply to that item.
 */
export function HotkeyIndexBadge({ index }: { index: number | undefined }) {
  if (index === undefined) return null;
  return <span className="mx-1 text-xs opacity-50 max-sm:hidden">{index + 1}</span>;
}
