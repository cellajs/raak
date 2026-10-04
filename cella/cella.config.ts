import { defineConfig } from '@cellajs/cli/config';

/**
 * Cella sync config: run with `pnpm cella` to interact with cella upstream or forks.
 */
export default defineConfig({
  settings: {
    upstreamUrl: 'git@github.com:cellajs/cella.git',
    upstreamBranch: 'main',
    upstreamTrack: 'branch',
    syncWithPackages: true,
    packageJsonSync: ['dependencies', 'devDependencies', 'scripts', 'overrides', 'exports'],
    fileLinkMode: 'file',
  },

  // File overrides
  overrides: {
    // Paths the fork fully owns: never synced (existing or new)
    // NOTE: package.jsons, lockfiles, this file are always ignored
    // NOTE: Modules with `app` owner are also ignored, including their public static asset folder
    ignored: [
      'README.md',
      'cella/cella.manifest.json',
      'infra/compose.gen.yml',
      'infra/Pulumi.production.yaml',
      'sdk/gen',
      'shared/config',
      'backend/drizzle',
      'frontend/src/content',
      'frontend/public/static/common',
      'frontend/src/modules/common/morph-animation',
      'frontend/src/routes/routeTree.gen.ts',
      '.github/release-please-manifest.json',
      '.github/release-please-config.json',
      'CLAUDE.md',
      // App identity: brand assets and the app's own locale namespace. cella has no upstream fix
      // to push into these, so they are never synced. Template-consumed copy lives in common.json,
      // never in app.json.
      'frontend/public/favicon.ico',
      'frontend/public/favicon.svg',
      'frontend/public/thumbnail.png',
      'frontend/src/modules/common/logo.tsx',
      'frontend/src/modules/auth/legal/legal-config.ts',
      'locales/en/app.json',
      'locales/nl/app.json',
      // Accessibility results are about one product: each app's audit (`pnpm a11y`) writes its own ledger.
      'json/accessibility-conformance.json',
    ],
    // Paths pinned to the app: the app copy always wins, upstream hunks never merge in. Adopt them by hand
    // from the analyze list ("protected but behind upstream").
    pinned: [
      'backend/src/db/channel-tables.ts',
      // Project-homed attachments: home column, publicAt inheritance, list scope and seed batches.
      'backend/src/modules/attachment/helpers/attachment-placement.ts',
      'backend/src/modules/auth/sso/role-from-claims.ts',
      'backend/src/modules.ts',
      'backend/src/bundle-config.ts',
      'backend/src/db/product-tables.ts',
      'backend/src/schemas/app-schemas.ts',
      'bench/src/seeds/ids.ts',
      'frontend/src/placement-config.ts',
      'frontend/src/routes-config.tsx',
      'frontend/src/menu-config.tsx',
      'frontend/src/alert-config.tsx',
      'frontend/src/list-queries-config.tsx',
      'frontend/src/styling/gradients.css',
      'frontend/src/styling/tailwind.css',
      // The pages and states the accessibility audit covers
      'a11y/scope-config.ts',
      'locales/en/about.json',
      'locales/nl/about.json',
      'backend/src/mocks/app-product-mocks.ts',
      'frontend/src/query/extra-local-user-stores.ts',
    ],
  },
});
