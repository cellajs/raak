CREATE TABLE "deleted_storage" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "deleted_storage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"entity_type" varchar(50) NOT NULL,
	"entity_id" uuid NOT NULL,
	"tenant_id" varchar(24),
	"organization_id" uuid,
	"storage" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "status_changed_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "attachments_deleted_at_index" ON "attachments" ("deleted_at") WHERE "deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "labels_deleted_at_index" ON "labels" ("deleted_at") WHERE "deleted_at" is not null;--> statement-breakpoint
CREATE INDEX "tasks_deleted_at_index" ON "tasks" ("deleted_at") WHERE "deleted_at" is not null;