import { cva } from 'class-variance-authority';

// Glow colors per status live in card-glow.css ([data-status] sets --glow-color-rgb)
export const taskCardVariants = cva('task-card', {
  variants: {
    status: {
      0: 'border-b-green-500/25 to-green-500/30',
      1: 'border-b-orange-500/25 to-orange-500/30',
      2: 'border-b-yellow-500/25 to-yellow-500/30',
      3: 'border-b-lime-500/25 to-lime-500/30',
      4: 'border-b-slate-500/40 to-slate-500/30',
      5: '',
      6: 'border-b-sky-500/30 to-sky-500/30',
    },
  },
});

export const statusButtonVariants = cva(
  [
    'border-[rgb(var(--sc)_/_0.4)] bg-[rgb(var(--sc)_/_0.03)]',
    'group-hover/task:border-[rgb(var(--sc)_/_0.5)] group-hover/task:bg-[rgb(var(--sc)_/_0.08)]',
    'group-[.is-focused]/task:border-[rgb(var(--sc)_/_0.5)] group-[.is-focused]/task:bg-[rgb(var(--sc)_/_0.08)]',
    'hover:border-[rgb(var(--sc)_/_0.7)] hover:bg-[rgb(var(--sc)_/_0.15)]',
  ].join(' '),
  {
    variants: {
      status: {
        0: 'text-green-600 [--sc:34_197_94]',
        1: '[--sc:249_115_22]',
        2: '[--sc:234_179_8]',
        3: '[--sc:132_204_22]',
        4: '[--sc:100_116_139]',
        5: '[--sc:100_116_139]',
        6: 'text-sky-600 [--sc:14_165_233]',
      },
    },
  },
);

export const statusFillColors = {
  0: 'fill-green-500',
  1: 'fill-orange-500',
  2: 'fill-yellow-500',
  3: 'fill-lime-500',
  4: 'fill-gray-400',
  5: 'fill-slate-500',
  6: 'fill-sky-500',
} as const;

/**
 * Left gutter + bottom padding for a task description, shared by the expanded (read-only) view
 * and the editing form so toggling edit mode doesn't shift the text.
 */
export const taskDescriptionGutterStyle = 'pl-1 sm:pl-9 pb-4';

/**
 * Faint accepted/iced section-bar colors, shared by the collapsed-panel sections and the board
 * skeleton so the accepted (green) / iced (sky) hue lives in one place. The interactive toggle
 * header in `specific-status-section` uses a richer, single-use palette and stays inline.
 */
export const statusSectionColors = {
  accepted: {
    fill: 'bg-green-500/5',
    text: 'text-green-500',
    border: 'border-b border-b-green-500/10',
  },
  iced: {
    fill: 'bg-sky-500/5',
    text: 'text-sky-500',
    border: 'border-t border-t-sky-500/10',
  },
} as const;

/** Available label colors for project labels */
export const labelColors = [
  '#A8E6CF',
  '#D0F0FD',
  '#D7CFF7',
  '#FFE0B2',
  '#FADADD',
  '#FF6F61',
  '#1DE9B6',
  '#FFD54F',
  '#40C4FF',
  '#B388FF',
  '#374785',
  '#2E7D32',
  '#D84315',
  '#546E7A',
  '#6A1B9A',
  '#00B8D4',
  '#5C6BC0',
  '#B2DFDB',
  '#CFD8DC',
  '#4A90E2',
];
