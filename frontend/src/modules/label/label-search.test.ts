import { describe, expect, it } from 'vitest';
import { labelSearchState, termsBesideLabels, toggleLabelSearch } from '~/modules/label/label-search';

describe('labelSearchState', () => {
  it('finds a name as a word, a quoted phrase or words typed one by one', () => {
    expect(labelSearchState('login FRONTEND', 'Frontend')).toBe('filter');
    expect(labelSearchState('=api "sync engine"', 'Sync engine')).toBe('highlight');
    expect(labelSearchState('=api sync engine', 'Sync engine')).toBe('highlight');
    expect(labelSearchState('api -"Needs design"', 'Needs design')).toBe('exclude');
    expect(labelSearchState('frontends', 'Frontend')).toBeNull();
    expect(labelSearchState('', 'Frontend')).toBeNull();
  });
});

describe('toggleLabelSearch', () => {
  it('adds a name in the asked mode, quoting a phrase, and takes it out again', () => {
    expect(toggleLabelSearch('', 'Sync engine', 'filter')).toBe('"Sync engine"');
    expect(toggleLabelSearch('"Sync engine"', 'Sync engine', 'filter')).toBe('');
    expect(toggleLabelSearch('', 'API', 'highlight')).toBe('=API');
    expect(toggleLabelSearch('Renée frontend API', 'Frontend', 'filter')).toBe('Renée API');
  });

  it('switches the whole search when the other mode is pressed', () => {
    expect(toggleLabelSearch('Frontend API', 'API', 'highlight')).toBe('=Frontend API');
    expect(toggleLabelSearch('=Frontend API', 'Sync', 'filter')).toBe('Frontend API Sync');
  });

  it('excludes in place, keeps the mode, and turns an exclusion back into a term', () => {
    expect(toggleLabelSearch('=Frontend Later', 'Later', 'exclude')).toBe('=Frontend -Later');
    expect(toggleLabelSearch('=Frontend -Later', 'Later', 'exclude')).toBe('=Frontend');
    expect(toggleLabelSearch('-"Needs design" api', 'Needs design', 'filter')).toBe('"Needs design" api');
    expect(toggleLabelSearch('=Later', 'Later', 'exclude')).toBe('-Later');
  });
});

describe('termsBesideLabels', () => {
  it('drops the words of each label named in the search', () => {
    expect(termsBesideLabels(['sync engine', 'perf'], ['Sync engine', 'API'])).toEqual(['perf']);
    expect(termsBesideLabels(['sync', 'engine', 'perf'], ['Sync engine'])).toEqual(['perf']);
    expect(termsBesideLabels(['perf'], ['Performance'])).toEqual(['perf']);
  });
});
