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
    // Paths the fork fully owns — never synced (existing or new)
    // NOTE: package.jsons, lockfiles, this file are always ignored
    // NOTE: Modules with `app` owner are also ignored, including their public static asset folder
    ignored: [
      'README.md',
      'cella.manifest.json',
      'infra/compose.gen.yml',
      'infra/Pulumi.production.yaml',
      'infra/Pulumi.staging.yaml',
      'sdk/gen',
      'shared/config',
      'backend/drizzle',
      'frontend/public/static/common',
      'frontend/src/modules/common/bg-animation',
      'frontend/src/routes/routeTree.gen.ts',
      'sdk/src/plugins/openapi-parser/tests/__snapshots__/parse-spec.test.ts.snap',
      '.github/release-please-manifest.json',
      '.github/release-please-config.json',
    ],
    // Paths pinned to fork; prefer fork version during merge conflicts
    pinned: [
      'backend/src/tables.ts',
      // Attachment module carries raak's task-host/project scoping
      'backend/src/modules/attachment/attachment-queries.ts',
      'backend/src/modules/attachment/operations/create-attachments.ts',
      'backend/src/modules/attachment/operations/get-attachments.ts',
      // Permission engine seam files: the topology seam landed upstream (cellajs/cella#861), but
      // raak carries its comment-sweep wording while upstream doesn't (yet). The logic is
      // identical; keep pinned until a sync reconciles the comments, then unpin so raak tracks
      // upstream engine changes. (The wide-fixture kit and converted tests are byte-identical to
      // upstream and were unpinned — they sync cleanly.)
      'shared/src/permissions/permission-manager/check.ts',
      'shared/src/permissions/permission-manager/types.ts',
      'shared/src/permissions/access-policies.ts',
      // row-predicates parity test: not yet upstreamed (config-adaptive generalization deferred,
      // see .todos/28); raak's version exercises the project sub-context narrowing.
      'backend/src/permissions/row-predicates.test.ts',
      // Fork-owned route/DB tests for raak-only features (own-read, public routes, task host
      // cascade, task seq reads) with no template counterpart (see .todos/28).
      'backend/tests/attachment-own-reads.test.ts',
      'backend/tests/public-read-routes.test.ts',
      'backend/tests/task-host-cascade.test.ts',
      'backend/tests/task-seq-reads.test.ts',
      'backend/src/routes.ts',
      'backend/src/modules/memberships/memberships-db.ts',
      'frontend/public/favicon.ico',
      'frontend/public/favicon.svg',
      'frontend/public/thumbnail.png',
      'frontend/src/nav-config.tsx',
      'frontend/src/routes-config.tsx',
      'frontend/src/menu-config.tsx',
      'frontend/src/alert-config.tsx',
      'frontend/src/list-queries-config.tsx',
      'frontend/src/styling/gradients.css',
      'frontend/src/modules/home/home-page.tsx',
      'frontend/src/modules/home/onboarding/onboarding-config.ts',
      'frontend/src/modules/home/onboarding/onboarding-seed.ts',
      'frontend/src/modules/common/logo.tsx',
      'frontend/src/modules/user/user-profile-content.tsx',
      'json/text-blocks.json',
      'locales/en/about.json',
      'locales/en/app.json',
    ],
  },
});
