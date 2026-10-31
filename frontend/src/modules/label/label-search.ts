import { foldText, parseTerms } from 'shared/utils/text-match';

const typedWords = (text: string) => text.trim().split(/\s+/).filter(Boolean);

/** Start of `run` as consecutive entries of `terms`, or -1. */
const findRun = (terms: string[], run: string[]) => {
  if (!run.length) return -1;
  for (let at = 0; at + run.length <= terms.length; at++) {
    if (run.every((term, offset) => terms[at + offset] === term)) return at;
  }
  return -1;
};

/** Whether the board search holds a label's name as whole words. */
export const isLabelInSearch = (q: string | undefined, name: string) => findRun(parseTerms(q), parseTerms(name)) >= 0;

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

/** The search after a label's toggle: its name goes in as words, or comes out again. */
export const toggleLabelSearch = (q: string | undefined, name: string) => {
  const words = typedWords(q ?? '');
  const run = parseTerms(name);
  const at = findRun(words.map(foldText), run);
  if (at < 0) return [...words, ...typedWords(name)].join(' ');
  return [...words.slice(0, at), ...words.slice(at + run.length)].join(' ');
};
