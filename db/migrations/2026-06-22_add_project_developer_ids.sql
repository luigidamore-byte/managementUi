ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS developer_ids integer[] DEFAULT '{}'::integer[];

-- Se esiste ancora il campo developer_id, copia i valori esistenti nella nuova colonna
UPDATE "Project"
SET developer_ids = ARRAY[developer_id]
WHERE developer_id IS NOT NULL;
