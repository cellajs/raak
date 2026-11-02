-- Every project membership is filed under a workspace: the menu lists a project under its workspace only.
-- A person with no unarchived workspace in the organization gets one named after it, as ensureUserWorkspace does.
-- No RLS wrapper: the migrate role owns these tables and RLS is not forced (10-rls side effect).
CREATE FUNCTION pg_temp.uuid_v7() RETURNS uuid LANGUAGE sql VOLATILE AS $$
  SELECT encode(
    set_bit(
      set_bit(
        overlay(uuid_send(gen_random_uuid()) PLACING substring(int8send((extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3) FROM 1 FOR 6),
        52, 1
      ),
      53, 1
    ),
    'hex'
  )::uuid
$$;
--> statement-breakpoint
CREATE TEMP TABLE new_workspaces AS
SELECT
  pg_temp.uuid_v7() AS id,
  needing.tenant_id,
  needing.organization_id,
  needing.user_id,
  organizations.name,
  left(users.slug || '-' || organizations.slug, 240) AS base_slug,
  row_number() OVER (PARTITION BY left(users.slug || '-' || organizations.slug, 240) ORDER BY needing.user_id) AS slug_rank,
  row_number() OVER (PARTITION BY needing.user_id ORDER BY needing.organization_id) AS user_rank
FROM (
  SELECT DISTINCT unfiled.tenant_id, unfiled.organization_id, unfiled.user_id
  FROM memberships unfiled
  WHERE unfiled.channel_type = 'project'
    AND unfiled.workspace_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM memberships held
      WHERE held.user_id = unfiled.user_id
        AND held.organization_id = unfiled.organization_id
        AND held.channel_type = 'workspace'
        AND held.archived = false
    )
) needing
JOIN users ON users.id = needing.user_id
JOIN organizations ON organizations.id = needing.organization_id;
--> statement-breakpoint
INSERT INTO workspaces (id, tenant_id, organization_id, name, slug, created_by)
SELECT
  new_workspaces.id,
  new_workspaces.tenant_id,
  new_workspaces.organization_id,
  new_workspaces.name,
  CASE
    WHEN new_workspaces.slug_rank = 1 AND NOT EXISTS (SELECT 1 FROM workspaces taken WHERE taken.slug = new_workspaces.base_slug)
      THEN new_workspaces.base_slug
    ELSE new_workspaces.base_slug || '-' || left(replace(gen_random_uuid()::text, '-', ''), 8)
  END,
  new_workspaces.user_id
FROM new_workspaces;
--> statement-breakpoint
INSERT INTO memberships (id, tenant_id, channel_type, channel_id, user_id, role, created_by, display_order, organization_id, workspace_id)
SELECT
  pg_temp.uuid_v7(),
  new_workspaces.tenant_id,
  'workspace',
  new_workspaces.id,
  new_workspaces.user_id,
  'admin',
  new_workspaces.user_id,
  coalesce((SELECT max(mine.display_order) FROM memberships mine WHERE mine.user_id = new_workspaces.user_id), 990) + new_workspaces.user_rank * 10,
  new_workspaces.organization_id,
  new_workspaces.id
FROM new_workspaces;
--> statement-breakpoint
CREATE TEMP TABLE refiled AS
SELECT
  unfiled.*,
  (
    SELECT held.channel_id
    FROM memberships held
    WHERE held.user_id = unfiled.user_id
      AND held.organization_id = unfiled.organization_id
      AND held.channel_type = 'workspace'
      AND held.archived = false
    ORDER BY held.display_order, held.channel_id
    LIMIT 1
  ) AS target_workspace_id
FROM memberships unfiled
WHERE unfiled.channel_type = 'project' AND unfiled.workspace_id IS NULL;
--> statement-breakpoint
-- workspace_id is immutable (memberships_immutable_keys), so a copy with the same id replaces each row.
DELETE FROM memberships WHERE id IN (SELECT id FROM refiled);
--> statement-breakpoint
INSERT INTO memberships (
  id, created_at, tenant_id, channel_type, channel_id, user_id, role, created_by, updated_at, updated_by,
  archived, muted, display_order, organization_id, workspace_id, project_id
)
SELECT
  id, created_at, tenant_id, channel_type, channel_id, user_id, role, created_by, updated_at, updated_by,
  archived, muted, display_order, organization_id, target_workspace_id, project_id
FROM refiled;
--> statement-breakpoint
-- A backfill that changed nothing has to stop the deploy, not pass unnoticed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM memberships WHERE channel_type = 'project' AND workspace_id IS NULL) THEN
    RAISE EXCEPTION 'project memberships without a workspace remain';
  END IF;
END
$$;
--> statement-breakpoint
DROP TABLE refiled;
--> statement-breakpoint
DROP TABLE new_workspaces;
--> statement-breakpoint
DROP FUNCTION pg_temp.uuid_v7();
