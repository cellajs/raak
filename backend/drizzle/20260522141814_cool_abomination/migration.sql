ALTER TABLE "sessions" ADD COLUMN "ip_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ip_subnet_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ip_country" varchar(2);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "ip_asn" integer;--> statement-breakpoint
CREATE INDEX "sessions_user_id_ip_hash_idx" ON "sessions" ("user_id","ip_hash");--> statement-breakpoint
CREATE INDEX "sessions_ip_subnet_hash_idx" ON "sessions" ("ip_subnet_hash");