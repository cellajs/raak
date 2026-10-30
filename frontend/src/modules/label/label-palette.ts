import type { LabelColorToken } from 'shared/config/labels-config';

interface LabelPaletteEntry {
  icon: string;
  dot: string;
}

/** Theme-aware classes per curated color token. A stored color may be free-form hex: check it with `isLabelColorToken` first. */
export const labelPalette: Record<LabelColorToken, LabelPaletteEntry> = {
  red: { icon: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  orange: {
    icon: 'text-orange-600 dark:text-orange-400',
    dot: 'bg-orange-500',
  },
  amber: {
    icon: 'text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  yellow: {
    icon: 'text-yellow-600 dark:text-yellow-400',
    dot: 'bg-yellow-500',
  },
  green: {
    icon: 'text-green-600 dark:text-green-400',
    dot: 'bg-green-500',
  },
  emerald: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  teal: { icon: 'text-teal-600 dark:text-teal-400', dot: 'bg-teal-500' },
  sky: { icon: 'text-sky-600 dark:text-sky-400', dot: 'bg-sky-500' },
  blue: { icon: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  indigo: {
    icon: 'text-indigo-600 dark:text-indigo-400',
    dot: 'bg-indigo-500',
  },
  violet: {
    icon: 'text-violet-600 dark:text-violet-400',
    dot: 'bg-violet-500',
  },
  pink: { icon: 'text-pink-600 dark:text-pink-400', dot: 'bg-pink-500' },
  // The gray of the support text step, so it follows the theme and the contrast setting as text does
  slate: { icon: 'text-muted-foreground', dot: 'bg-slate-500' },
};

export const isLabelColorToken = (color: string | null | undefined): color is LabelColorToken => color != null && color in labelPalette;

export const labelIconColorClass = (color: string | null | undefined) => (isLabelColorToken(color) ? labelPalette[color].icon : undefined);
