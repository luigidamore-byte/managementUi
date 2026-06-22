ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS team_leading_developer_ids integer[] DEFAULT '{}'::integer[];

UPDATE "Project"
SET team_leading_developer_ids = ARRAY[]::integer[]
WHERE team_leading_developer_ids IS NULL;
