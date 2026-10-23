import { cva } from 'class-variance-authority';

// Glow colors per status live in card-glow.css ([data-status] sets --glow-color-rgb)
export const taskCardVariants = cva('', {
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
        0: 'text-green-700 [--sc:34_197_94] dark:text-green-500',
        1: '[--sc:249_115_22]',
        2: '[--sc:234_179_8]',
        3: '[--sc:132_204_22]',
        4: '[--sc:100_116_139]',
        5: '[--sc:100_116_139]',
        6: 'text-sky-700 [--sc:14_165_233] dark:text-sky-500',
      },
    },
  },
);

/**
 * Left gutter + bottom padding for a task description, shared by the expanded (read-only) view
 * and the editing form so toggling edit mode doesn't shift the text.
 */
export const taskDescriptionGutterStyle = 'pl-1 sm:pl-9 pb-4';

/**
 * Reveals a task card's action buttons on hover or focus. The collapsed summary fades its first line out under them
 * on the same states (`.task-summary-fade` in card-glow.css): keep the two in step.
 */
export const taskCardActionsReveal =
  'opacity-0 transition-opacity group-hover/task:opacity-100 group-focus-within/task:opacity-100 group-[.is-focused]/task:opacity-100 group-data-[sheet]/task:opacity-100 has-data-dropdowner-done:opacity-100';

/** Shared shell classes for the board/table top bar (search, count, actions). */
export const taskBarClass = 'z-85 flex items-center bg-background max-sm:justify-between max-sm:p-2 sm:gap-2';

/** Accepted/iced section-bar colors for the panel section headers, the collapsed panel and the board skeleton, so a strip keeps its fill through a collapse. */
export const statusSectionColors = {
  accepted: { fill: 'bg-green-50 dark:bg-green-950', text: 'text-green-700 dark:text-green-400', border: 'border-b border-b-green-500/10' },
  iced: { fill: 'bg-sky-50 dark:bg-sky-950', text: 'text-sky-700 dark:text-sky-400', border: 'border-t border-t-sky-500/10' },
} as const;

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
