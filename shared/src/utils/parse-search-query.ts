/**
 * Parse a board search query. A leading '=' switches search from filtering to highlighting:
 * consumers show all rows and tint the matches instead of hiding the rest. `effectiveQ` is
 * the query with the marker stripped; `highlight` is only true when content follows it.
 * Single source for the marker so frontend views and backend list filters stay in sync.
 */
export const parseSearchQuery = (q: string | null | undefined): { highlight: boolean; effectiveQ: string } => {
  const trimmed = q?.trim() ?? '';
  const marked = trimmed.startsWith('=');
  const effectiveQ = (marked ? trimmed.slice(1) : trimmed).trim();
  return { highlight: marked && effectiveQ.length > 0, effectiveQ };
};
