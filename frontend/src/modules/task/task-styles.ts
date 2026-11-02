import { cva } from 'class-variance-authority';
import { tw } from '~/utils/tw';

// Glow colors per status live in card-glow.css ([data-status] sets --glow-color-rgb)
export const taskCardVariants = cva('', {
  variants: {
    status: {
      0: 'border-b-green-500/25 to-green-500/26 dark:to-green-500/22',
      1: 'border-b-orange-500/25 to-orange-500/26 dark:to-orange-500/22',
      3: 'border-b-lime-500/25 to-lime-500/26 dark:to-lime-500/22',
      4: 'border-b-slate-500/40 to-slate-500/26 dark:to-slate-500/22',
      5: '',
      6: 'border-b-sky-500/30 to-sky-500/26 dark:to-sky-500/22',
    },
  },
});

// --sc tints the fill. --se draws the edge: a darker step in light mode, where the 500 steps stay under 3:1 on white.
export const statusButtonVariants = cva(
  'border-[rgb(var(--se))] bg-[rgb(var(--sc)_/_0.12)] hover:border-[rgb(var(--se))] hover:bg-[rgb(var(--sc)_/_0.25)] group-hover/task:bg-[rgb(var(--sc)_/_0.17)] group-[.is-focused]/task:bg-[rgb(var(--sc)_/_0.17)]',
  {
    variants: {
      status: {
        0: 'text-green-800 [--sc:34_197_94] [--se:22_163_74] dark:text-green-300 dark:[--se:34_197_94]',
        1: 'text-orange-800 [--sc:249_115_22] [--se:234_88_12] dark:text-orange-300 dark:[--se:249_115_22]',
        3: 'text-lime-800 [--sc:132_204_22] [--se:101_163_13] dark:text-lime-300 dark:[--se:132_204_22]',
        4: 'text-foreground-soft [--sc:100_116_139] [--se:100_116_139]',
        5: 'text-foreground-soft [--sc:100_116_139] [--se:100_116_139]',
        6: 'text-sky-800 [--sc:14_165_233] [--se:2_132_199] dark:text-sky-300 dark:[--se:14_165_233]',
      },
    },
  },
);

/** Shared by the expanded view and the editing form so toggling edit mode does not shift the text. */
export const taskDescriptionGutterClass = tw('pb-4 pl-1 sm:pl-9');

/** A board item's focus bar shows while focus is on or in it, or in a menu or dropdown opened from it, not merely while it is current. */
export const itemFocusBarClass = tw(
  'focus-within:before:opacity-100 has-[[aria-haspopup][aria-expanded=true]]:before:opacity-100 has-data-dropdowner-active:before:opacity-100',
);

/** `itemFocusBarClass` for the bar a task card draws on its content. */
export const taskCardFocusBarClass = tw(
  'group-focus-within/task:before:opacity-100 group-has-[[aria-haspopup][aria-expanded=true]]/task:before:opacity-100 group-has-data-dropdowner-active/task:before:opacity-100',
);

/** A ghost button on a task card: a solid grey fill goes dead over the status gradient, a translucent one lets it through. */
export const taskCardGhostClass = tw('hover:bg-foreground/7 aria-expanded:bg-foreground/7 dark:hover:bg-foreground/7');

/** Dims a task card's own buttons until the card is hovered or current. */
export const taskCardDimClass = tw('opacity-80 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100');

/** Greys the avatars of a collapsed task card until it is hovered or holds focus. */
export const taskCardAvatarRestClass = tw('group-[[data-state=collapsed]:not(:hover,:focus-within,.is-focused)]/task:resting-avatar');

/** A task card's metadata, which brightens with the card on hover or focus. */
export const taskCardMetaClass = tw(
  'text-muted-foreground transition-colors group-focus-within/task:text-foreground-soft group-hover/task:text-foreground-soft group-[.is-focused]/task:text-foreground-soft',
);

/** Reveals a task card's action buttons on hover or focus; keep in step with `.task-summary-fade` in card-glow.css. */
export const taskCardActionsRevealClass = tw(
  'opacity-0 transition-opacity group-focus-within/task:opacity-100 group-hover/task:opacity-100 group-[.is-focused]/task:opacity-100 has-data-dropdowner-done:opacity-100 group-data-[sheet=true]/task:opacity-100',
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
    /** Under the bar in an open tile: the shade `fill` ends on, so bar and note read as one surface. */
    tileBody: 'bg-background bg-linear-to-b from-green-500/26 to-green-500/26 dark:from-green-500/22 dark:to-green-500/22',
    text: 'text-green-800 dark:text-green-300',
    border: { top: 'border-b border-b-green-600/30 dark:border-b-green-400/20', bottom: 'border-t border-t-green-600/30 dark:border-t-green-400/20' },
  },
  iced: {
    fill: 'bg-background bg-linear-to-b from-sky-500/18 to-sky-500/26 dark:from-sky-500/15 dark:to-sky-500/22',
    text: 'text-sky-800 dark:text-sky-300',
    border: { top: 'border-b border-b-sky-600/30 dark:border-b-sky-400/20', bottom: 'border-t border-t-sky-600/30 dark:border-t-sky-400/20' },
  },
} as const;
