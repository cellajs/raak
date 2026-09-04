import type { VocabularyAllowlist } from '../scripts/check-app-vocabulary.ts';

/**
 * App-owned exceptions for `pnpm style`'s terminology check: files and path prefixes that may
 * carry the CLI's source-control term, such as a full lucide icon name list
 * (`json/lucide-icon-names.json`) or generated data. Paths are repo-root relative.
 */
export const vocabularyAllowlist: VocabularyAllowlist = {
  files: [
    // Generated lucide data: the flagged term appears only as an icon name, never as vocabulary.
    'json/lucide-icon-names.json',
    'frontend/src/modules/common/icons/lucide-icons.gen.json',
    'frontend/public/static/icons/lucide-sprite.svg',
    // Carries a cella-sync marker comment, whose syntax is the flagged term by convention.
    'backend/tests/attachment-notifications.test.ts',
  ],
  prefixes: [],
};
