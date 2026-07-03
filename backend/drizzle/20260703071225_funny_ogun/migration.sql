DROP POLICY "chats_select_policy" ON "chats";--> statement-breakpoint
DROP POLICY "chats_insert_policy" ON "chats";--> statement-breakpoint
DROP POLICY "chats_update_policy" ON "chats";--> statement-breakpoint
DROP POLICY "chats_delete_policy" ON "chats";--> statement-breakpoint
DROP POLICY "messages_select_policy" ON "messages";--> statement-breakpoint
DROP POLICY "messages_insert_policy" ON "messages";--> statement-breakpoint
DROP POLICY "messages_update_policy" ON "messages";--> statement-breakpoint
DROP POLICY "messages_delete_policy" ON "messages";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "messages_chat_id_chats_id_fkey";--> statement-breakpoint
DROP TABLE "chats";--> statement-breakpoint
DROP TABLE "messages";--> statement-breakpoint
DROP TABLE "seen_counts";--> statement-breakpoint
DROP INDEX "workspace_name_index";--> statement-breakpoint
DROP INDEX "workspace_created_at_index";--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "restrictions" SET DEFAULT '{"quotas":{"user":1000,"organization":5,"workspace":0,"project":0,"task":0,"label":0,"attachment":100,"page":0},"rateLimits":{"apiPointsPerHour":1000}}';--> statement-breakpoint
CREATE INDEX "workspaces_name_index" ON "workspaces" ("name" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workspaces_created_at_index" ON "workspaces" ("created_at" DESC NULLS LAST);