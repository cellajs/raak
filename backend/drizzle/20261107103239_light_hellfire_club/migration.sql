ALTER TABLE "sandboxes" RENAME TO "demos";--> statement-breakpoint
ALTER INDEX "sandboxes_created_at_index" RENAME TO "demos_created_at_index";--> statement-breakpoint
ALTER INDEX "sandboxes_expires_at_index" RENAME TO "demos_expires_at_index";--> statement-breakpoint
ALTER INDEX "sandboxes_user_id_index" RENAME TO "demos_user_id_index";--> statement-breakpoint
ALTER INDEX "sandboxes_share_code_index" RENAME TO "demos_share_code_index";--> statement-breakpoint
UPDATE "sessions" SET "auth_strategy" = 'demo' WHERE "auth_strategy" = 'sandbox';--> statement-breakpoint
UPDATE "users" SET "email" = replace("email", '@sandbox.invalid', '@demo.invalid') WHERE "email" LIKE '%@sandbox.invalid';
