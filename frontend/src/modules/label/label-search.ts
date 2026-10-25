import { parseSearchQuery } from 'shared/utils/parse-search-query';
import { foldText, parseTerms } from 'shared/utils/text-match';

export type LabelSearchMode = 'filter' | 'highlight';
/** A label tile's toggles: in the board search (by mode) or hidden from the board, never both. */
export type LabelAction = LabelSearchMode | 'hide';

/** Start of `run` as consecutive entries of `terms`, or -1. */
const findRun = (terms: string[], run: string[]) => {
  if (!run.length) return -1;
  for (let at = 0; at + run.length <= terms.length; at++) {
    if (run.every((term, offset) => terms[at + offset] === term)) return at;
  }
  return -1;
};

/** Whether the search terms hold a label's name as whole consecutive words. */
export const hasLabelName = (terms: string[], name: string) => findRun(terms, parseTerms(name)) >= 0;

/** How the board search holds a label; null when its name is not in the search as whole words. */
export const labelSearchMode = (q: string | undefined, name: string): LabelSearchMode | null => {
  const { highlight, terms } = parseSearchQuery(q);
  if (!hasLabelName(terms, name)) return null;
  return highlight ? 'highlight' : 'filter';
};

/** The search terms left once each label named in the search takes out its words. */
export const termsBesideLabels = (terms: string[], names: string[]) => {
  const covered = new Set<number>();
  for (const name of names) {
    const run = parseTerms(name);
    const at = findRun(terms, run);
    if (at < 0) continue;
    for (let index = at; index < at + run.length; index++) covered.add(index);
  }
  return terms.filter((_, index) => !covered.has(index));
};

// Words keep their typed form; only the comparison folds them
const splitQuery = (q: string | undefined) => {
  const { highlight, effectiveQ } = parseSearchQuery(q);
  const words = effectiveQ.split(/\s+/).filter(Boolean);
  return { highlight, words, at: (name: string) => findRun(words.map(foldText), parseTerms(name)) };
};

const joinQuery = (words: string[], highlight: boolean) => (words.length ? `${highlight ? '=' : ''}${words.join(' ')}` : '');

/** The search without a label's name; other words and the mode stay as typed. */
export const withoutLabelSearch = (q: string | undefined, name: string) => {
  const { highlight, words, at } = splitQuery(q);
  const start = at(name);
  if (start < 0) return q ?? '';
  return joinQuery([...words.slice(0, start), ...words.slice(start + parseTerms(name).length)], highlight);
};

/**
 * The search after a label's filter or highlight toggle. The search has one mode, so the other mode's toggle switches
 * the whole search and every label in it; the active one takes the label out.
 */
export const toggleLabelSearch = (q: string | undefined, name: string, mode: LabelSearchMode) => {
  if (labelSearchMode(q, name) === mode) return withoutLabelSearch(q, name);
  const { words, at } = splitQuery(q);
  return joinQuery(at(name) < 0 ? [...words, ...name.trim().split(/\s+/)] : words, mode === 'highlight');
};

/** Label slugs in the board's `hide` param, joined by '_' like other list params (a slug has none). */
export const parseHiddenLabels = (hide: string | undefined) => (hide ? hide.split('_').filter(Boolean) : []);

export const toggleHiddenLabel = (hide: string | undefined, slug: string) => {
  const slugs = parseHiddenLabels(hide);
  return (slugs.includes(slug) ? slugs.filter((hidden) => hidden !== slug) : [...slugs, slug]).join('_');
};
