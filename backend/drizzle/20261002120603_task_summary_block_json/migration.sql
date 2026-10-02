-- tasks.summary becomes the summary block as a one-block BlockNote document, as
-- deriveDocument (shared/utils/derive-description-core) stores it; rows written before
-- hold server-rendered HTML. The block is findSummarySource's: the first non-checklist
-- block with text, else the first block. summaryLength already counts that block.
-- Only changed rows are written, so a re-run is a no-op.
-- No RLS wrapper: the migrate role owns tasks and RLS is not forced (10-rls side effect),
-- so the backfill sees every row; re-forcing it would block the CDC worker's seq stamps.
UPDATE "tasks" t SET "summary" = derived.summary
FROM (
  SELECT d.id, CASE
    -- CASE branches evaluate in order, so the cast never meets a body that is not JSON.
    WHEN d.description IS NULL OR NOT pg_input_is_valid(d.description, 'jsonb') THEN ''
    WHEN jsonb_typeof(d.description::jsonb) <> 'array' THEN ''
    ELSE COALESCE((
      SELECT CASE WHEN jsonb_typeof(b.block) = 'object' THEN jsonb_build_array(b.block)::text ELSE '' END
      FROM jsonb_array_elements(d.description::jsonb) WITH ORDINALITY AS b(block, ord)
      ORDER BY (
        b.block->>'type' IS DISTINCT FROM 'checklistItem'
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(b.block->'content') = 'array' THEN b.block->'content' ELSE '[]'::jsonb END) AS c(item)
          WHERE jsonb_typeof(c.item->'text') = 'string' AND c.item->>'text' ~ '\S'
        )
      ) DESC, b.ord
      LIMIT 1
    ), '')
  END AS summary
  FROM "tasks" d
) derived
WHERE derived.id = t.id AND t."summary" IS DISTINCT FROM derived.summary;
