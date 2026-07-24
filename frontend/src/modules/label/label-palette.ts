import type { LabelColorToken } from 'shared';

interface LabelPaletteEntry {
  /** Accent color for icons and standalone glyphs */
  icon: string;
  /** Subtle badge surface with readable text in both themes */
  badge: string;
  /** Solid color dot */
  dot: string;
}

/**
 * Theme-aware class triples per curated label color token. Primary labels store the token
 * (not hex) in `label.color`; secondary labels still carry legacy free-hex values, so check
 * with isLabelColorToken before resolving.
 */
export const labelPalette: Record<LabelColorToken, LabelPaletteEntry> = {
  red: {
    icon: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    dot: 'bg-red-500',
  },
  orange: {
    icon: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300',
    dot: 'bg-orange-500',
  },
  amber: {
    icon: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  yellow: {
    icon: 'text-yellow-600 dark:text-yellow-400',
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
    dot: 'bg-yellow-500',
  },
  green: {
    icon: 'text-green-600 dark:text-green-400',
    badge: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    dot: 'bg-green-500',
  },
  emerald: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  teal: {
    icon: 'text-teal-600 dark:text-teal-400',
    badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300',
    dot: 'bg-teal-500',
  },
  sky: {
    icon: 'text-sky-600 dark:text-sky-400',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  blue: {
    icon: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  indigo: {
    icon: 'text-indigo-600 dark:text-indigo-400',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
    dot: 'bg-indigo-500',
  },
  violet: {
    icon: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
    dot: 'bg-violet-500',
  },
  pink: {
    icon: 'text-pink-600 dark:text-pink-400',
    badge: 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300',
    dot: 'bg-pink-500',
  },
  slate: {
    icon: 'text-slate-600 dark:text-slate-400',
    badge: 'bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-300',
    dot: 'bg-slate-500',
  },
};

/** Narrow a stored label color to a curated palette token (legacy labels carry free hex). */
export const isLabelColorToken = (color: string | null | undefined): color is LabelColorToken =>
  color != null && color in labelPalette;
