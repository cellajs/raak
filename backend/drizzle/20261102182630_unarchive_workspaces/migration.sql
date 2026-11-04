-- A workspace can no longer be archived, only the projects in it (menuStructure `archivable: false`).
-- Whoever archived a workspace keeps its projects out of sight: they stay off that person's board, each restored on its own.
-- No RLS wrapper: the migrate role owns these tables and RLS is not forced (10-rls side effect).
UPDATE memberships AS project
SET archived = true, updated_at = now(), updated_by = project.user_id
FROM memberships AS workspace
WHERE workspace.channel_type = 'workspace'
  AND workspace.archived = true
  AND project.channel_type = 'project'
  AND project.user_id = workspace.user_id
  AND project.workspace_id = workspace.channel_id
  AND project.archived = false;
--> statement-breakpoint
UPDATE memberships
SET archived = false, updated_at = now(), updated_by = user_id
WHERE channel_type = 'workspace'
  AND archived = true;
