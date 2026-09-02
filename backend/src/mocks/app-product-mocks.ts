import type { ProductEntityType } from 'shared';
import type { ProductMockFn } from '#/mocks/product-mock-registry';
import { mockLabel } from '#/modules/label/label-mocks';
import { mockTask } from '#/modules/task/task-mocks';

/**
 * Merged into `productMocksByType`: one entry per app-owned product entity type, so the config-driven
 * insert suites (RLS, CDC, sequence) can seed those rows. The registry's `satisfies` enforces coverage.
 */
export const appProductMocks = {
  task: mockTask,
  label: mockLabel,
} satisfies Partial<Record<ProductEntityType, ProductMockFn>>;
