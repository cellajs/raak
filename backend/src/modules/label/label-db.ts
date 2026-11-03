import { sql } from 'drizzle-orm';
import { boolean, doublePrecision, index, integer, snakeCase, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
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
    /** Counted per organization: 0 until the insert trigger assigns it, as the client placeholder has it. */
    number: integer().notNull().default(0),
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
    uniqueIndex('labels_organization_number_unique').on(table.organizationId, table.number),
    index('labels_organization_id_name_index').on(table.organizationId, table.name, table.id),
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
