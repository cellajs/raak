/**
 * Load-test project seed — self-registers into the bench seed registry.
 *
 * Fork-owned seed (raak entity). Tasks FK-reference projects, so this seeds
 * before tasks (lower `order`). See `attachment.bench.ts` for the reference pattern.
 *
 * Runs in Node.js (data-setup), not in Artillery scenarios.
 */

import type { InsertProjectModel } from '#/modules/project/project-db';
import { mockProject } from '#/modules/project/project-mocks';
import { registerBenchSeed } from '../registry';
import { CORE_ID_VARIANTS, ORG_ID, projectId, TENANT_ID } from './ids';

export const TOTAL_PROJECTS = 10;

/**
 * Generate a load-test project record by index.
 *
 * `mockProject` leaks a `description` key that is not a real `projects` column,
 * so it is stripped (the registry derives INSERT columns from record keys).
 */
export const loadtestProject = (index: number): InsertProjectModel => {
  const { description: _description, ...record } = mockProject(`lt-${index}`) as InsertProjectModel & {
    description?: unknown;
  };
  return {
    ...record,
    id: projectId(index),
    tenantId: TENANT_ID,
    name: `Load Test Project ${index}`,
    slug: `xbench-project-${index}`,
    organizationId: ORG_ID,
    publicAt: null,
  };
};

registerBenchSeed({
  table: 'projects',
  order: 110,
  idVariant: CORE_ID_VARIANTS.project,
  rows: ({ now }) => Array.from({ length: TOTAL_PROJECTS }, (_, i) => ({ ...loadtestProject(i), createdAt: now })),
});
