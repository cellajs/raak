import type { VocabularyAllowlist } from '../scripts/check-app-vocabulary.ts';

/**
 * App-owned exceptions for `pnpm style`: files and path prefixes that may carry the CLI's source-control term, such as
 * a full lucide icon name list (`json/lucide-icon-names.json`) or generated data, and in `proseExclude` the path
 * prefixes the comment and doc checks skip. Paths are repo-root relative. `markerClasses` lists class names the app
 * keeps as hooks with no Tailwind utility or stylesheet rule behind them, each with its reason.
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
  proseExclude: [],
  markerClasses: {
    // The auth layout's veil calms the backdrop animation behind the form. raak draws no backdrop animation, so its
    // pinned gradients.css leaves both classes without a rule and the two elements stay empty.
    'rich-veil-gradient': 'auth veil, unused without a backdrop animation',
    'rich-veil-background': 'auth veil, unused without a backdrop animation',
  },
};
