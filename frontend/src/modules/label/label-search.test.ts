import { describe, expect, it } from 'vitest';
import {
  labelSearchMode,
  parseHiddenLabels,
  termsBesideLabels,
  toggleHiddenLabel,
  toggleLabelSearch,
  withoutLabelSearch,
} from '~/modules/label/label-search';

describe('labelSearchMode', () => {
  it('finds a name as whole consecutive words, folded', () => {
    expect(labelSearchMode('login FRONTEND', 'Frontend')).toBe('filter');
    expect(labelSearchMode('=api sync engine', 'Sync engine')).toBe('highlight');
    expect(labelSearchMode('frontends', 'Frontend')).toBeNull();
    expect(labelSearchMode('engine sync', 'Sync engine')).toBeNull();
    expect(labelSearchMode('', 'Frontend')).toBeNull();
  });
});

describe('toggleLabelSearch', () => {
  it('adds the name in the asked mode and takes it out again', () => {
    expect(toggleLabelSearch('', 'Sync engine', 'filter')).toBe('Sync engine');
    expect(toggleLabelSearch('Sync engine', 'Sync engine', 'filter')).toBe('');
    expect(toggleLabelSearch('', 'API', 'highlight')).toBe('=API');
  });

  it('adds a second label and keeps typed words as typed', () => {
    expect(toggleLabelSearch('Renée frontend', 'API', 'filter')).toBe('Renée frontend API');
    expect(toggleLabelSearch('Renée frontend API', 'Frontend', 'filter')).toBe('Renée API');
  });

  it('switches the whole search when the other mode is pressed', () => {
    expect(toggleLabelSearch('Frontend API', 'API', 'highlight')).toBe('=Frontend API');
    expect(toggleLabelSearch('=Frontend API', 'Sync', 'filter')).toBe('Frontend API Sync');
  });
});

describe('withoutLabelSearch', () => {
  it('keeps the mode while words remain and leaves other searches alone', () => {
    expect(withoutLabelSearch('=Frontend API', 'API')).toBe('=Frontend');
    expect(withoutLabelSearch('=API', 'API')).toBe('');
    expect(withoutLabelSearch('=Frontend', 'API')).toBe('=Frontend');
  });
});

describe('termsBesideLabels', () => {
  it('drops the words of each label named in the search', () => {
    expect(termsBesideLabels(['sync', 'engine', 'perf'], ['Sync engine', 'API'])).toEqual(['perf']);
    expect(termsBesideLabels(['perf'], ['Performance'])).toEqual(['perf']);
  });
});

describe('hidden labels', () => {
  it('toggles slugs in the underscore-joined param', () => {
    expect(toggleHiddenLabel(undefined, 'later')).toBe('later');
    expect(toggleHiddenLabel('later', 'needs-design')).toBe('later_needs-design');
    expect(toggleHiddenLabel('later_needs-design', 'later')).toBe('needs-design');
    expect(parseHiddenLabels('later__needs-design')).toEqual(['later', 'needs-design']);
  });
});
