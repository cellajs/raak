CREATE TABLE "sandboxes" (
	"id" uuid PRIMARY KEY,
	"tenant_id" varchar(24) NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"content_version" varchar(64) NOT NULL,
	"status" varchar DEFAULT 'ready' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"claimed_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "sandboxes_status_created_at_index" ON "sandboxes" ("status","created_at");--> statement-breakpoint
CREATE INDEX "sandboxes_user_id_index" ON "sandboxes" ("user_id");--> statement-breakpoint
ALTER TABLE "sandboxes" ADD CONSTRAINT "sandboxes_tenant_id_tenants_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sandboxes" ADD CONSTRAINT "sandboxes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;