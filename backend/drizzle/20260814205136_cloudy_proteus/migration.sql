ALTER TABLE "passkeys" ADD COLUMN "counter" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "redirect_path" varchar(255);