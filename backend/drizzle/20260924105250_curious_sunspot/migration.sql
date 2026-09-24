CREATE TABLE "actors" (
	"id" uuid PRIMARY KEY,
	"kind" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "actors" ("id", "kind", "created_at") SELECT "id", 'user', "created_at" FROM "users";--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"id" varchar(255) PRIMARY KEY,
	"name" varchar(255) NOT NULL,
	"secret_hash" varchar(255),
	"redirect_uris" jsonb DEFAULT '[]' NOT NULL,
	"logo_uri" varchar(2048),
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "oidc_payloads" (
	"id" varchar(255),
	"type" varchar(64),
	"payload" jsonb NOT NULL,
	"grant_id" varchar(255),
	"account_id" varchar(255),
	"uid" varchar(255),
	"expires_at" timestamp,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oidc_payloads_pkey" PRIMARY KEY("type","id")
);
--> statement-breakpoint
CREATE TABLE "signing_keys" (
	"id" varchar(255) PRIMARY KEY,
	"alg" varchar(16) DEFAULT 'RS256' NOT NULL,
	"status" varchar NOT NULL,
	"private_jwk" text NOT NULL,
	"public_jwk" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"retired_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY,
	"actor_id" uuid NOT NULL,
	"tenant_id" varchar(24) NOT NULL,
	"name" varchar(255) NOT NULL,
	"prefix" varchar(255) NOT NULL,
	"hash" varchar(255) NOT NULL,
	"last4" varchar(4) NOT NULL,
	"scopes" varchar(255)[],
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"revoked_by" uuid,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_accounts" (
	"id" uuid PRIMARY KEY,
	"tenant_id" varchar(24) NOT NULL,
	"name" varchar(255) NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"bindings" jsonb DEFAULT '[]' NOT NULL,
	"oauth_client_id" varchar(255),
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_created_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_updated_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_deleted_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "labels" DROP CONSTRAINT "labels_created_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "labels" DROP CONSTRAINT "labels_updated_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "labels" DROP CONSTRAINT "labels_deleted_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_created_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_updated_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_created_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "projects_updated_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_created_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_updated_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_deleted_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_created_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_updated_by_users_id_fkey";--> statement-breakpoint
ALTER TABLE "emails" RENAME COLUMN "last_verified_by" TO "last_verified_via";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "revoked_by" uuid;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "revocation_reason" varchar;--> statement-breakpoint
-- sessions, tokens and unsubscribe_tokens leave partitioning: they are small, retention is a nightly
-- DELETE in maintain_partitions(), and a primary key on (id) alone is impossible on a table
-- partitioned by another column. Databases that a previous migration partitioned are flattened
-- first: a plain copy takes over the name, keeping data, defaults, foreign keys, indexes and
-- triggers. Untouched databases (never partitioned) skip straight to the key change below.
DO $$
DECLARE
  tbl text;
  ddl text;
  fk_defs text[];
  idx_defs text[];
  trg_defs text[];
BEGIN
  FOREACH tbl IN ARRAY ARRAY['sessions', 'tokens', 'unsubscribe_tokens'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_partitioned_table pt JOIN pg_class c ON c.oid = pt.partrelid
      WHERE c.relname = tbl AND c.relnamespace = 'public'::regnamespace
    ) THEN
      CONTINUE;
    END IF;

    -- Definitions are captured before the rename so they name the final table
    SELECT COALESCE(array_agg(format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', tbl, con.conname, pg_get_constraintdef(con.oid))), '{}')
      INTO fk_defs
      FROM pg_constraint con
      WHERE con.conrelid = format('public.%I', tbl)::regclass AND con.contype = 'f';
    SELECT COALESCE(array_agg(pg_get_indexdef(i.indexrelid)), '{}') INTO idx_defs
      FROM pg_index i
      WHERE i.indrelid = format('public.%I', tbl)::regclass
        AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid);
    SELECT COALESCE(array_agg(pg_get_triggerdef(t.oid)), '{}') INTO trg_defs
      FROM pg_trigger t
      WHERE t.tgrelid = format('public.%I', tbl)::regclass AND NOT t.tgisinternal;

    EXECUTE format('ALTER TABLE public.%I RENAME TO %I', tbl, tbl || '_part');
    EXECUTE format('CREATE TABLE public.%I (LIKE public.%I INCLUDING ALL EXCLUDING INDEXES)', tbl, tbl || '_part');
    EXECUTE format('INSERT INTO public.%I SELECT * FROM public.%I', tbl, tbl || '_part');
    -- Drops the partitions with it and frees the index names for the replay
    EXECUTE format('DROP TABLE public.%I CASCADE', tbl || '_part');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (id)', tbl, tbl || '_pkey');
    FOREACH ddl IN ARRAY fk_defs LOOP EXECUTE ddl; END LOOP;
    FOREACH ddl IN ARRAY idx_defs LOOP EXECUTE ddl; END LOOP;
    FOREACH ddl IN ARRAY trg_defs LOOP EXECUTE ddl; END LOOP;
    RAISE NOTICE '% flattened to a plain table', tbl;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey";--> statement-breakpoint
ALTER TABLE "sessions" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "tokens" DROP CONSTRAINT "tokens_pkey";--> statement-breakpoint
ALTER TABLE "tokens" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "unsubscribe_tokens" DROP CONSTRAINT "unsubscribe_tokens_pkey";--> statement-breakpoint
ALTER TABLE "unsubscribe_tokens" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "restrictions" SET DEFAULT '{"quotas":{"user":1000,"organization":1,"workspace":0,"project":0,"task":0,"label":0,"attachment":100,"serviceAccount":20,"apiKey":100},"rateLimits":{"apiPointsPerHour":1000},"allowUnregisteredClients":true}';--> statement-breakpoint
CREATE INDEX "oidc_payloads_grant_id_idx" ON "oidc_payloads" ("grant_id");--> statement-breakpoint
CREATE INDEX "oidc_payloads_account_id_idx" ON "oidc_payloads" ("account_id");--> statement-breakpoint
CREATE INDEX "oidc_payloads_uid_idx" ON "oidc_payloads" ("uid");--> statement-breakpoint
CREATE INDEX "oidc_payloads_expires_at_idx" ON "oidc_payloads" ("expires_at");--> statement-breakpoint
CREATE INDEX "signing_keys_status_idx" ON "signing_keys" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_keys_one_per_status_idx" ON "signing_keys" ("status") WHERE "status" in ('current', 'next');--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_hash_idx" ON "api_keys" ("hash");--> statement-breakpoint
CREATE INDEX "api_keys_actor_id_idx" ON "api_keys" ("actor_id");--> statement-breakpoint
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys" ("tenant_id");--> statement-breakpoint
CREATE INDEX "service_accounts_tenant_id_idx" ON "service_accounts" ("tenant_id");--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_created_by_actors_id_fkey" FOREIGN KEY ("created_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_updated_by_actors_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deleted_by_actors_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_revoked_by_actors_id_fkey" FOREIGN KEY ("revoked_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_created_by_actors_id_fkey" FOREIGN KEY ("created_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_updated_by_actors_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_deleted_by_actors_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_created_by_actors_id_fkey" FOREIGN KEY ("created_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_created_by_actors_id_fkey" FOREIGN KEY ("created_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_updated_by_actors_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_actors_id_fkey" FOREIGN KEY ("created_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_updated_by_actors_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_actor_id_actors_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "actors"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_tenants_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_revoked_by_actors_id_fkey" FOREIGN KEY ("revoked_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_actors_id_fkey" FOREIGN KEY ("created_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_id_actors_id_fkey" FOREIGN KEY ("id") REFERENCES "actors"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_tenant_id_tenants_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_oauth_client_id_oauth_clients_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "oauth_clients"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_created_by_actors_id_fkey" FOREIGN KEY ("created_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "service_accounts" ADD CONSTRAINT "service_accounts_updated_by_actors_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_actors_id_fkey" FOREIGN KEY ("created_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_actors_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deleted_by_actors_id_fkey" FOREIGN KEY ("deleted_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_actors_id_fkey" FOREIGN KEY ("id") REFERENCES "actors"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_actors_id_fkey" FOREIGN KEY ("created_by") REFERENCES "actors"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_updated_by_actors_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "actors"("id") ON DELETE SET NULL;