CREATE TABLE "devices" (
	"user_id" uuid,
	"device_id_hash" varchar(64),
	"first_seen_at" timestamp NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	"notified_at" timestamp,
	CONSTRAINT "devices_pkey" PRIMARY KEY("user_id","device_id_hash")
);
--> statement-breakpoint
ALTER TABLE "identities" RENAME COLUMN "provider_user_id" TO "subject";--> statement-breakpoint
DROP INDEX "identities_provider_subject_idx";--> statement-breakpoint
-- Hand-added: the provider slug becomes the issuer slug, so rows survive the drop and the NOT NULL below.
UPDATE "identities" SET "issuer" = "provider";--> statement-breakpoint
ALTER TABLE "identities" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "identities" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "devices_user_id_notified_at_idx" ON "devices" ("user_id","notified_at");--> statement-breakpoint
CREATE INDEX "devices_last_seen_at_idx" ON "devices" ("last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "identities_kind_issuer_subject_idx" ON "identities" ("kind","issuer","subject");--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;