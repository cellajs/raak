import { defineConfig } from '@cellajs/cli/config';

/**
 * Cella CLI config: run with `pnpm cella` to interact with cella upstream or forks.
 */
export default defineConfig({
  settings: {
    upstreamUrl: 'git@github.com:cellajs/cella.git',
    upstreamBranch: 'main',
    upstreamTrack: 'branch',
    mergePackageJson: true,
    packageJsonKeys: ['dependencies', 'devDependencies', 'scripts', 'overrides', 'exports', 'engines', 'packageManager'],
    fileLinkMode: 'file',
  },

  // File overrides
  overrides: {
    // Paths the fork fully owns: never merged (existing or new)
    // NOTE: package.jsons, lockfiles, this file are always ignored
    // NOTE: Modules with `app` owner are also ignored, including their public static asset folder
    ignored: [
      'README.md',
      'cella/cella.manifest.json',
      'infra/compose.gen.yml',
      'infra/Pulumi.production.yaml',
      'infra/environments',
      'infra/runner.json',
      'sdk/gen',
      'shared/config',
      'backend/drizzle',
      'frontend/src/content',
      'frontend/public/static/common',
      'frontend/src/modules/common/morph-animation',
      'frontend/src/routes/routeTree.gen.ts',
      'frontend/src/routes/_public/_marketing',
      'frontend/src/routes/_public/_marketing.tsx',
      '.github/release-please-manifest.json',
      '.github/release-please-config.json',
      'CLAUDE.md',
      'frontend/public/favicon.ico',
      'frontend/public/favicon.svg',
      'frontend/public/thumbnail.png',
      'frontend/src/modules/common/logo.tsx',
      'frontend/vite/react-compiler-allowlist.app.json',
      'frontend/src/styling/app.css',
      'frontend/src/modules/auth/legal/legal-config.ts',
      'locales/en/app.json',
      'locales/nl/app.json',
      'locales/en/about.json',
      'locales/nl/about.json',
      'locales/en/appError.json',
      'locales/nl/appError.json',
      'json/accessibility-conformance.json',
    ],
    // Paths pinned to the app: the app copy always wins, upstream hunks never merge in. Adopt them by hand
    // from the analyze list ("protected but behind upstream").
    pinned: [
      'backend/src/db/channel-tables.ts',
      'backend/src/modules/attachment/attachment-placement.ts',
      'backend/src/modules/notification/notification-seed-subjects.ts',
      'backend/src/modules.ts',
      'backend/src/bundle-config.ts',
      'backend/src/db/product-tables.ts',
      'backend/src/schemas/app-schemas.ts',
      'frontend/src/routes-config.tsx',
      'frontend/src/alert-config.tsx',
      'cella/skills/screenshots/shots-config.mjs',
      'frontend/src/entity-sync-queries.ts',
      'frontend/src/styling/gradients.css',
      'a11y/scope-config.ts',
      'bench/src/seeds/attachment-home.ts',
      'backend/src/mocks/app-product-mocks.ts',
      'frontend/src/query/extra-local-user-stores.ts',
    ],
  },
});
