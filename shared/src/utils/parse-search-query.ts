import { foldText } from './text-match';

/** A word or quoted phrase of a board search, as typed without its quotes; a leading '-' excludes it. */
export type SearchPart = { text: string; exclude: boolean };

// '-' excludes only at the start of a part, so 'front-end' stays one word; a quote still being typed runs to the end
const partPattern = /(-?)(?:"([^"]*)"?|(\S+))/g;

/** The words and quoted phrases of a query without its '=' marker. A lone '-' is an exclusion still being typed. */
export const parseSearchParts = (query: string): SearchPart[] => {
  const parts: SearchPart[] = [];
  for (const [, minus, phrase, word] of query.matchAll(partPattern)) {
    const text = (phrase ?? word ?? '').trim().replace(/\s+/g, ' ');
    if (text && text !== '-') parts.push({ text, exclude: !!minus });
  }
  return parts;
};

/** Writes parts back as a query, quoting a phrase. */
export const formatSearchParts = (parts: SearchPart[]) =>
  parts.map(({ text, exclude }) => `${exclude ? '-' : ''}${/\s/.test(text) ? `"${text}"` : text}`).join(' ');

/**
 * Parse a board search query. A leading '=' switches the search from filtering to highlighting: consumers keep every
 * row visible and tint the matches. A '-' word or phrase leaves tasks out in either mode. `terms` are the folded words
 * and phrases to match, `excludeTerms` the excluded ones, and `highlight` is only true when a term follows the marker.
 * Single source for the grammar so frontend views and backend list filters stay in sync.
 */
export const parseSearchQuery = (q: string | null | undefined) => {
  const trimmed = q?.trim() ?? '';
  const marked = trimmed.startsWith('=');
  const effectiveQ = (marked ? trimmed.slice(1) : trimmed).trim();
  const parts = parseSearchParts(effectiveQ);
  const terms = parts.filter((part) => !part.exclude).map((part) => foldText(part.text));
  const excludeTerms = parts.filter((part) => part.exclude).map((part) => foldText(part.text));
  return { highlight: marked && terms.length > 0, effectiveQ, parts, terms, excludeTerms };
};
