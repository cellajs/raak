import { tw } from '~/utils/tw';

/**
 * Row/tile tint for '=' highlight-mode search matches, shared by board task cards, the
 * tasks table and the labels panel so matches read identically across surfaces.
 */
export const searchHighlightRowClass = tw('bg-green-300/20 hover:bg-green-300/30');
