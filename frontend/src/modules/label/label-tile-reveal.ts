/** Height-and-fade reveal shared by a tile's body, its epic description and a project's status counts. */
export const labelTileReveal = {
  initial: { height: 0, opacity: 0, overflow: 'hidden' },
  // Visible once open, so the description editor's menus are not clipped
  animate: { height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } },
  exit: { height: 0, opacity: 0, overflow: 'hidden' },
  transition: { duration: 0.28, ease: [0.2, 0.8, 0.2, 1] },
} as const;
