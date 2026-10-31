import { describe, expect, it } from 'vitest';
import { isLabelInSearch, termsBesideLabels, toggleLabelSearch } from '~/modules/label/label-search';

describe('isLabelInSearch', () => {
  it('finds a name as whole words', () => {
    expect(isLabelInSearch('login FRONTEND', 'Frontend')).toBe(true);
    expect(isLabelInSearch('api sync engine', 'Sync engine')).toBe(true);
    expect(isLabelInSearch('frontends', 'Frontend')).toBe(false);
    expect(isLabelInSearch('', 'Frontend')).toBe(false);
  });
});

describe('toggleLabelSearch', () => {
  it('adds a name and takes it out again', () => {
    expect(toggleLabelSearch('', 'Sync engine')).toBe('Sync engine');
    expect(toggleLabelSearch('api Sync engine', 'Sync engine')).toBe('api');
    expect(toggleLabelSearch('Renée frontend API', 'Frontend')).toBe('Renée API');
  });
});

describe('termsBesideLabels', () => {
  it('drops the words of each label named in the search', () => {
    expect(termsBesideLabels(['sync', 'engine', 'perf'], ['Sync engine', 'API'])).toEqual(['perf']);
    expect(termsBesideLabels(['perf'], ['Performance'])).toEqual(['perf']);
  });
});
