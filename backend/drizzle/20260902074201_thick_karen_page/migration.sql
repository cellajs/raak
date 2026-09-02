CREATE TABLE "notification_preferences" (
	"user_id" uuid PRIMARY KEY,
	"mention_email" boolean DEFAULT true NOT NULL,
	"comment_email" boolean DEFAULT false NOT NULL,
	"digest" varchar DEFAULT 'weekly' NOT NULL,
	"last_digest_at" timestamp,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid,
	"created_at" timestamp DEFAULT now(),
	"user_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" varchar NOT NULL,
	"entity_type" varchar NOT NULL,
	"subject_id" uuid NOT NULL,
	"context_id" uuid,
	"channel_id" uuid NOT NULL,
	"channel_type" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"tenant_id" varchar(24) NOT NULL,
	"activity_id" varchar(64) NOT NULL,
	"read_at" timestamp,
	"emailed_at" timestamp,
	"digested_at" timestamp,
	CONSTRAINT "notifications_pkey" PRIMARY KEY("id","created_at")
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"expiration_time" timestamp,
	"user_agent" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "tools_config" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "mentions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "tools_config" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "notifications_user_activity_index" ON "notifications" ("user_id","activity_id","type");--> statement-breakpoint
CREATE INDEX "notifications_user_unread_index" ON "notifications" ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_index" ON "notifications" ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_subject_index" ON "notifications" ("subject_id");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_index" ON "push_subscriptions" ("user_id");--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;