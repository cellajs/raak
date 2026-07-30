import type { ProductEntityType } from 'shared';
import type { ProductMockFn } from '#/mocks/product-mock-registry';
import { mockLabel } from '#/modules/label/label-mocks';
import { mockTask } from '#/modules/task/task-mocks';

/**
 * App-owned product mock factories, merged into `productMocksByType`.
 *
 * Cella ships none; apps add one entry per product entity type they introduce (e.g. `task: mockTask`)
 * so the shared config-driven insert suites (RLS, CDC, sequence) can seed those rows. The registry's
 * `satisfies Record<ProductEntityType, ProductMockFn>` still enforces that every product type is covered.
 */
export const appProductMocks = {
  task: mockTask,
  label: mockLabel,
} satisfies Partial<Record<ProductEntityType, ProductMockFn>>;
