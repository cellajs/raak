import { cva } from 'class-variance-authority';
import { tw } from '~/utils/tw';

// Glow colors per status live in card-glow.css ([data-status] sets --glow-color-rgb)
// The bottom lines' alphas differ per hue and theme so each coloured line lands near 1.5:1 on the background: at one alpha, yellow vanishes and slate underlines.
export const taskCardVariants = cva('', {
  variants: {
    status: {
      0: 'border-b-green-500/46 to-green-500/26 dark:border-b-green-500/23 dark:to-green-500/22',
      1: 'border-b-orange-500/37 to-orange-500/26 dark:border-b-orange-500/27 dark:to-orange-500/22',
      3: 'border-b-yellow-500/61 to-yellow-500/26 dark:border-b-yellow-500/20 dark:to-yellow-500/22',
      4: 'border-b-slate-500/32 to-slate-500/26 dark:border-b-slate-500/36 dark:to-slate-500/22',
      5: 'border-b-[oklch(0.912_0.004_285.75)] dark:border-b-[oklch(0.292_0.004_285.75)]',
      6: 'border-b-sky-500/40 to-sky-500/26 dark:border-b-sky-500/26 dark:to-sky-500/22',
    },
  },
});

/** A status's text color: its button's label, and a read-only card's status. */
export const statusTextColors = {
  0: 'text-green-800 dark:text-green-300',
  1: 'text-orange-800 dark:text-orange-300',
  3: 'text-yellow-800 dark:text-yellow-300',
  4: 'text-foreground-soft',
  5: 'text-foreground-soft',
  6: 'text-sky-800 dark:text-sky-300',
} as const;

// Borderless: a board full of one status would read as a column of boxes. --sc tints the fill.
export const statusButtonVariants = cva(
  'border-transparent bg-[rgb(var(--sc)_/_0.12)] hover:border-transparent hover:bg-[rgb(var(--sc)_/_0.25)] group-hover/task:bg-[rgb(var(--sc)_/_0.17)] group-[.is-focused]/task:bg-[rgb(var(--sc)_/_0.17)]',
  {
    variants: {
      status: {
        0: `${statusTextColors[0]} [--sc:34_197_94]`,
        1: `${statusTextColors[1]} [--sc:249_115_22]`,
        3: `${statusTextColors[3]} [--sc:234_179_8]`,
        4: `${statusTextColors[4]} [--sc:100_116_139]`,
        5: `${statusTextColors[5]} [--sc:100_116_139]`,
        6: `${statusTextColors[6]} [--sc:14_165_233]`,
      },
    },
  },
);

// Classes, as svg attributes cannot follow the theme. The icons keep their fill and stroke attributes: search chips select on them to recolor.
/** Draws a status icon in the text color around it, so it matches the verb or name beside it. */
export const statusIconInTextClass = tw('[&_[fill]:not([fill=none])]:fill-current [&_[stroke]]:stroke-current');

/** The status icons' colors: a darker step in light mode, where the 500 steps stay under 3:1 on white. Backlog stays a quiet grey. */
export const statusIconColors = {
  accepted: { fill: 'fill-[#16a34a] dark:fill-[#22c55e]', stroke: 'stroke-[#16a34a] dark:stroke-[#22c55e]' },
  reviewed: { fill: 'fill-[#ea580c] dark:fill-[#f97316]', stroke: 'stroke-[#ea580c] dark:stroke-[#f97316]' },
  finished: { fill: 'fill-[#ca8a04] dark:fill-[#eab308]', stroke: 'stroke-[#ca8a04] dark:stroke-[#eab308]' },
  iced: { fill: 'fill-[#0284c7] dark:fill-[#0ea5e9]', stroke: 'stroke-[#0284c7] dark:stroke-[#0ea5e9]' },
  unstarted: { stroke: 'stroke-muted-foreground' },
} as const;

/** An open card's text edge: on the status button's border, past the type button's column. A sheet has no such column. */
const taskTextEdgeClass = tw('pl-8 group-data-[sheet=true]/task:pl-0');

/** Shared by the expanded view and the editing form so toggling edit mode does not shift the text. */
export const taskDescriptionGutterClass = tw`pb-4 ${taskTextEdgeClass}`;

// A tap leaves focus behind in what it touched, which would hold a card's focus look until the next tap elsewhere. So on a
// touch screen the card states below follow keyboard focus only; with a fine pointer any focus inside counts, as before.

/** A board item's focus bar shows while focus is on or in it, or in a menu or dropdown opened from it, not merely while it is current. */
export const itemFocusBarClass = tw(
  'pointer-fine:focus-within:before:opacity-100 focus-visible:before:opacity-100 has-[:focus-visible]:before:opacity-100 has-[[aria-haspopup][aria-expanded=true]]:before:opacity-100 has-data-dropdowner-active:before:opacity-100',
);

/** `itemFocusBarClass` for the bar a task card draws on its content. */
export const taskCardFocusBarClass = tw(
  'pointer-fine:group-focus-within/task:before:opacity-100 group-focus-visible/task:before:opacity-100 group-has-[:focus-visible]/task:before:opacity-100 group-has-[[aria-haspopup][aria-expanded=true]]/task:before:opacity-100 group-has-data-dropdowner-active/task:before:opacity-100',
);

/** A ghost button on a task card: a solid grey fill goes dead over the status gradient, a translucent one lets it through. */
export const taskCardGhostClass = tw('hover:bg-foreground/7 aria-expanded:bg-foreground/7 dark:hover:bg-foreground/7');

/** Dims a task card's own buttons until the card is hovered or current. */
export const taskCardDimClass = tw('opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100');

/** Greys the avatars of a collapsed task card until it is hovered or holds focus. */
export const taskCardAvatarRestClass = tw(
  'pointer-fine:group-[[data-state=collapsed]:not(:hover,:focus-within,.is-focused)]/task:resting-avatar pointer-coarse:group-[[data-state=collapsed]:not(:focus-visible,:has(:focus-visible),.is-focused)]/task:resting-avatar',
);

/** A task card's metadata, which brightens with the card on hover or focus. */
export const taskCardMetaClass = tw(
  'text-foreground-soft transition-colors pointer-fine:group-focus-within/task:text-foreground group-hover/task:text-foreground group-focus-visible/task:text-foreground group-[.is-focused]/task:text-foreground group-has-[:focus-visible]/task:text-foreground',
);

/** Reveals a task card's action buttons on hover or focus; keep in step with `.task-summary-fade` in card-glow.css. */
export const taskCardActionsRevealClass = tw(
  'opacity-0 transition-opacity pointer-fine:group-focus-within/task:opacity-100 group-hover/task:opacity-100 group-focus-visible/task:opacity-100 group-[.is-focused]/task:opacity-100 has-data-dropdowner-done:opacity-100 group-has-[:focus-visible]/task:opacity-100 group-data-[sheet=true]/task:opacity-100',
);

/** Shared by the panel header's drag handle and the board skeleton's stand-in, so the strip keeps its shape through loading. */
export const panelHandleClass = tw('flex h-auto items-center justify-start gap-2 p-0 hover:bg-transparent');

/** Shared by the "+ Task" button and the board skeleton's stand-ins. */
export const newTaskButtonClass = tw('relative hidden rounded sm:inline-flex');

export const taskBarClass = tw('z-85 flex items-center bg-background max-sm:justify-between max-sm:p-2 sm:gap-2');

/** Shared by the panel section headers, the collapsed panel and the board skeleton, so a strip keeps its fill through a collapse. */
export const statusSectionColors = {
  accepted: {
    fill: 'bg-background bg-linear-to-b from-green-500/18 to-green-500/26 dark:from-green-500/15 dark:to-green-500/22',
    text: 'text-green-800 dark:text-green-300',
    border: { top: 'border-b border-b-green-600/30 dark:border-b-green-400/20', bottom: 'border-t border-t-green-600/30 dark:border-t-green-400/20' },
  },
  iced: {
    fill: 'bg-background bg-linear-to-b from-sky-500/18 to-sky-500/26 dark:from-sky-500/15 dark:to-sky-500/22',
    text: 'text-sky-800 dark:text-sky-300',
    border: { top: 'border-b border-b-sky-600/30 dark:border-b-sky-400/20', bottom: 'border-t border-t-sky-600/30 dark:border-t-sky-400/20' },
  },
} as const;
