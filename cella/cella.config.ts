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
    packageJsonSync: ['dependencies', 'devDependencies', 'scripts', 'overrides'],
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
      'frontend/src/modules/common/bg-animation',
      'frontend/src/routes/routeTree.gen.ts',
      '.github/release-please-manifest.json',
      '.github/release-please-config.json',
      'CLAUDE.md',
    ],
    // Paths pinned to fork; prefer fork version during merge conflicts
    pinned: [
      'backend/src/tables.ts',
      'backend/src/db/channel-tables.ts',
      // Project-homed attachments: home column, publicAt inheritance, list scope and seed batches.
      'backend/src/modules/attachment/helpers/attachment-placement.ts',
      'backend/src/modules.ts',
      'bench/src/seeds/ids.ts',
      'backend/src/routes.ts',
      'backend/src/modules/memberships/memberships-db.ts',
      'frontend/public/favicon.ico',
      'frontend/public/favicon.svg',
      'frontend/public/thumbnail.png',
      'frontend/src/nav-config.tsx',
      'frontend/src/placement-config.ts',
      'frontend/src/routes-config.tsx',
      'frontend/src/menu-config.tsx',
      'frontend/src/alert-config.tsx',
      'frontend/src/list-queries-config.tsx',
      'frontend/src/styling/gradients.css',
      'frontend/src/styling/tailwind.css',
      'frontend/src/modules/home/onboarding/onboarding-config.ts',
      'frontend/src/modules/common/logo.tsx',
      'locales/en/about.json',
      'locales/en/app.json',
      'locales/nl/about.json',
      'backend/src/modules/organization/setup-config-schema.ts',
      'backend/src/mocks/app-product-mocks.ts',
      'frontend/src/query/extra-local-user-stores.ts',
      'frontend/src/query/realtime/register-channel-paths.ts',
    ],
  },
});
