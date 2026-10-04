CREATE TABLE "connections" (
	"id" uuid PRIMARY KEY,
	"tenant_id" varchar(24) NOT NULL,
	"kind" varchar DEFAULT 'sso' NOT NULL,
	"issuer" varchar(255) NOT NULL,
	"claim_values" varchar(255)[] DEFAULT '{}'::varchar(255)[] NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"jit_provisioning" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
DROP TABLE "domains";--> statement-breakpoint
-- Hand-ordered: the activity times move from user_counters to the user's actors row before the table goes. user_counters
-- was UNLOGGED, so after a crash it may be empty; whatever it holds is carried over.
ALTER TABLE "actors" ADD COLUMN "last_seen_at" timestamp;--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "last_sign_in_at" timestamp;--> statement-breakpoint
UPDATE "actors" SET "last_seen_at" = "user_counters"."last_seen_at", "last_sign_in_at" = "user_counters"."last_sign_in_at" FROM "user_counters" WHERE "user_counters"."user_id" = "actors"."id";--> statement-breakpoint
DROP TABLE "user_counters";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "auth_strategy" varchar;--> statement-breakpoint
ALTER TABLE "tokens" ADD COLUMN "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "requests" ADD COLUMN "invited_at" timestamp;--> statement-breakpoint
-- Hand-added: a request an invitation went out for stays invited. Its time is the token's while that row still
-- exists, else the request's own.
UPDATE "requests" SET "invited_at" = coalesce((SELECT "tokens"."created_at" FROM "tokens" WHERE "tokens"."id" = "requests"."token_id"), "requests"."created_at") WHERE "requests"."token_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "requests" DROP COLUMN "token_id";--> statement-breakpoint
ALTER TABLE "product_counters" DROP COLUMN "last_viewed_at";--> statement-breakpoint
ALTER TABLE "inactive_memberships" DROP COLUMN "token_id";--> statement-breakpoint
ALTER TABLE "tenants" DROP COLUMN "subscription_data";--> statement-breakpoint
-- Hand-added: every emails row is a proven inbox, so verified_at becomes the proof. A row no proof ever wrote cannot
-- stay a magic-link sign-in identifier and goes; a proven row without its time takes the latest proof's, else its
-- creation time.
DELETE FROM "emails" WHERE "verified" = false;--> statement-breakpoint
UPDATE "emails" SET "verified_at" = coalesce("last_verified_at", "created_at") WHERE "verified_at" IS NULL;--> statement-breakpoint
ALTER TABLE "emails" DROP COLUMN "verified";--> statement-breakpoint
ALTER TABLE "identities" ALTER COLUMN "connection_id" SET DATA TYPE uuid USING "connection_id"::uuid;--> statement-breakpoint
ALTER TABLE "emails" ALTER COLUMN "verified_at" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "connections_tenant_id_idx" ON "connections" ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "connections_tenant_id_kind_idx" ON "connections" ("tenant_id","kind");--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_connection_id_connections_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_connection_id_connections_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_connection_id_connections_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "connections"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_tenant_id_tenants_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "connections" ADD CONSTRAINT "connections_created_by_actors_id_fkey" FOREIGN KEY ("created_by") REFERENCES "actors"("id") ON DELETE SET NULL;