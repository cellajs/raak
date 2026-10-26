import { formatSearchParts, parseSearchQuery, type SearchPart } from 'shared/utils/parse-search-query';
import { foldText, parseTerms } from 'shared/utils/text-match';

/** A label tile's toggles: how the board search holds the label, which is one way at most. */
export type LabelAction = 'filter' | 'highlight' | 'exclude';

const nameKey = (name: string) => parseTerms(name).join(' ');

/** Start of `run` as consecutive entries of `terms`, or -1. */
const findRun = (terms: string[], run: string[]) => {
  if (!run.length) return -1;
  for (let at = 0; at + run.length <= terms.length; at++) {
    if (run.every((term, offset) => terms[at + offset] === term)) return at;
  }
  return -1;
};

/** Where a label's name stands among the search terms: one quoted phrase or word, or its words typed one by one. */
const findName = (terms: string[], name: string) => {
  const single = terms.indexOf(nameKey(name));
  if (single >= 0) return { at: single, count: 1 };
  const run = parseTerms(name);
  const at = findRun(terms, run);
  return at >= 0 ? { at, count: run.length } : null;
};

/** Whether the search terms (folded, from `parseSearchQuery`) hold a label's name as whole words. */
const hasLabelName = (terms: string[], name: string) => !!findName(terms, name);

/** How the board search holds a label; null when its name is not in the search as whole words. */
export const labelSearchState = (q: string | undefined, name: string): LabelAction | null => {
  const { highlight, terms, excludeTerms } = parseSearchQuery(q);
  if (excludeTerms.includes(nameKey(name))) return 'exclude';
  if (!hasLabelName(terms, name)) return null;
  return highlight ? 'highlight' : 'filter';
};

/** The search terms left once each label named in the search takes out its words. */
export const termsBesideLabels = (terms: string[], names: string[]) => {
  const covered = new Set<number>();
  for (const name of names) {
    const found = findName(terms, name);
    if (!found) continue;
    for (let index = found.at; index < found.at + found.count; index++) covered.add(index);
  }
  return terms.filter((_, index) => !covered.has(index));
};

const replaceAt = (parts: SearchPart[], at: number, count: number, ...insert: SearchPart[]) => [
  ...parts.slice(0, at),
  ...insert,
  ...parts.slice(at + count),
];

/**
 * The search after a label's toggle. Filter and highlight put its name in as typed words; the search has one mode, so
 * the other mode's toggle switches the whole search and every label in it. Exclude puts it in with a '-'. The pressed
 * toggle takes the label out; another one moves it in place.
 */
export const toggleLabelSearch = (q: string | undefined, name: string, action: LabelAction) => {
  const { parts } = parseSearchQuery(q);
  const wasMarked = !!q?.trim().startsWith('=');
  const current = labelSearchState(q, name);

  const label: SearchPart = { text: name.trim().replace(/\s+/g, ' '), exclude: action === 'exclude' };
  const included = findName(
    parts.map((part) => (part.exclude ? '' : foldText(part.text))),
    name,
  );
  const excludedAt = parts.findIndex((part) => part.exclude && foldText(part.text) === nameKey(name));
  const found = current === 'exclude' ? { at: excludedAt, count: 1 } : included;

  let next: SearchPart[];
  if (current === action) next = found ? replaceAt(parts, found.at, found.count) : parts;
  else if (found && (current === 'exclude' || action === 'exclude')) next = replaceAt(parts, found.at, found.count, label);
  else next = found ? parts : [...parts, label];

  const highlight = action === 'exclude' ? wasMarked : action === 'highlight';
  const text = formatSearchParts(next);
  // A marker with no term left to highlight would only linger in the URL
  return text ? `${highlight && next.some((part) => !part.exclude) ? '=' : ''}${text}` : '';
};
