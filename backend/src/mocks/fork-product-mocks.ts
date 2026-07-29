import type { ProductEntityType } from 'shared';
import type { ProductMockFn } from '#/mocks/product-mock-registry';
import { mockLabel } from '#/modules/label/label-mocks';
import { mockTask } from '#/modules/task/task-mocks';

/**
 * Fork-owned product mock factories, merged into `productMocksByType`.
 *
 * raak registers its task and label product entities so the shared config-driven insert suites
 * (RLS, CDC, sequence) can seed those rows. The registry's `satisfies Record<ProductEntityType,
 * ProductMockFn>` still enforces that every product type is covered.
 */
export const forkProductMocks = {
  task: mockTask,
  label: mockLabel,
} satisfies Partial<Record<ProductEntityType, ProductMockFn>>;
