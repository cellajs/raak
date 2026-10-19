import { sql } from 'drizzle-orm';
import { boolean, doublePrecision, snakeCase, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import type { LabelMode } from 'shared/config/labels-config';
import { tenantSelectPolicy, writeThroughPolicies } from '#/db/rls-helpers';
import { channelRelationColumns, channelRelationIndexes } from '#/db/utils/channel-relation-columns';
import { maxLength } from '#/db/utils/constraints';
import { organizationForeignKey } from '#/db/utils/organization-foreign-key';
import { productColumns, productIndexes } from '#/db/utils/product-columns';

/**
 * Labels table is a lightweight product entity table.
 * Each label belongs to exactly one project and inherits its organization + tenant (RLS isolation boundary).
 * `mode` distinguishes primary (task type), secondary (free-form tag) and epic (grouping) labels.
 * `slug` is the label's stable identity for cross-project matching and organization tracking;
 * `organizationTracked` marks primary rows still in sync with the organization's setupConfig.
 */
export const labelsTable = snakeCase.table(
  'labels',
  {
    ...productColumns('label'),
    color: varchar({ length: maxLength.field }),
    mode: varchar({ length: maxLength.field }).notNull().default('secondary').$type<LabelMode>(),
    slug: varchar({ length: maxLength.field }).notNull(),
    icon: varchar({ length: maxLength.field }),
    organizationTracked: boolean().notNull().default(false),
    displayOrder: doublePrecision(),
    ...channelRelationColumns('label'),
  },
  (table) => [
    ...productIndexes('labels', table),
    // One live primary label per slug within a project; secondary/epic labels are exempt.
    uniqueIndex('labels_project_primary_slug_unique')
      .on(table.projectId, table.slug)
      .where(sql`${table.mode} = 'primary' AND ${table.deletedAt} IS NULL`),
    ...channelRelationIndexes('labels', table, 'label'),
    organizationForeignKey(table),
    tenantSelectPolicy('labels', table),
    ...writeThroughPolicies('labels'),
  ],
);

export type LabelModel = typeof labelsTable.$inferSelect;
export type InsertLabelModel = typeof labelsTable.$inferInsert;
