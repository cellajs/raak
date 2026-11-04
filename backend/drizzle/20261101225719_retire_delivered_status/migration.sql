-- Delivered (2) is retired. Its tasks go back to Finished (3): nobody has reviewed them yet.
-- The value stays unused rather than renumbering the rest, which old clients would misread.
-- changedFields goes so the CDC worker attributes the write from the WAL diff, not from a task's last edit
-- (a stale 'description' there would count as a body change for mention notifications).
-- No RLS wrapper: the migrate role owns tasks and RLS is not forced (10-rls side effect).
UPDATE "tasks" SET "status" = 3, "stx" = "stx" - 'changedFields' WHERE "status" = 2;
