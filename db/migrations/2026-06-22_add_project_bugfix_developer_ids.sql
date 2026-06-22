ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS bugfix_developer_ids integer[] DEFAULT '{}'::integer[];

UPDATE "Project"
SET bugfix_developer_ids = ARRAY[]::integer[]
WHERE bugfix_developer_ids IS NULL;
