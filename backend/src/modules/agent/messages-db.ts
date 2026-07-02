import { foreignKey, index, jsonb, snakeCase, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenantSelectPolicy, writeThroughPolicies } from '#/db/rls-helpers';
import { maxLength } from '#/db/utils/constraints';
import { contextRelationColumns } from '#/db/utils/context-relation-columns';
import { productEntityColumns } from '#/db/utils/product-entity-columns';
import { chatsTable } from '#/modules/agent/chats-db';
import { organizationsTable } from '#/modules/organization/organization-db';
import { projectsTable } from '#/modules/project/project-db';
import { usersTable } from '#/modules/user/user-db';
import { workspacesTable } from '#/modules/workspace/workspace-db';

/**
 * AI chat messages. Maps to TanStack AI's `UIMessage` type.
 * `role` follows the standard LLM convention: 'user' | 'assistant' | 'system' | 'tool'.
 * `parts` stores TanStack AI `MessagePart[]` (text, tool-call, tool-result, thinking) as jsonb.
 * `status` tracks streaming lifecycle: 'pending' | 'streaming' | 'complete' | 'error' | 'cancelled'.
 * @see https://github.com/TanStack/ai
 */
export const messagesTable = snakeCase.table(
  'messages',
  {
    ...productEntityColumns('message'),
    ...contextRelationColumns('message'),
    chatId: uuid()
      .notNull()
      .references(() => chatsTable.id, { onDelete: 'cascade' }),
    userId: uuid().references(() => usersTable.id, { onDelete: 'set null' }),
    role: varchar({ length: maxLength.field }).notNull(),
    parts: jsonb().notNull().default([]),
    model: varchar({ length: maxLength.field }),
    status: varchar({ length: maxLength.field }).notNull().default('pending'),
    usage: jsonb(),
    error: text(),
  },
  (table) => [
    index('messages_organization_id_index').on(table.organizationId),
    index('messages_project_seq_index').on(table.projectId, table.seq),
    index('messages_chat_id_index').on(table.chatId),
    index('messages_user_id_index').on(table.userId),
    index('messages_tenant_id_index').on(table.tenantId),
    index('messages_created_by_index').on(table.createdBy),
    index('messages_updated_by_index').on(table.updatedBy),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizationsTable.tenantId, organizationsTable.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.workspaceId],
      foreignColumns: [workspacesTable.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [table.projectId],
      foreignColumns: [projectsTable.id],
    }).onDelete('set null'),
    tenantSelectPolicy('messages', table),
    ...writeThroughPolicies('messages'),
  ],
);

export type MessageModel = typeof messagesTable.$inferSelect;
export type InsertMessageModel = typeof messagesTable.$inferInsert;
