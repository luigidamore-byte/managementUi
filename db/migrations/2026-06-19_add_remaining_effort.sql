-- Migration: Aggiunge colonne remaining effort in ore alla tabella Project e popola con valori esistenti
BEGIN;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS dev_remaining_h numeric,
  ADD COLUMN IF NOT EXISTS bugfix_remaining_h numeric,
  ADD COLUMN IF NOT EXISTS tl_remaining_h numeric;

-- Se esistono già i campi effort_h, usali come remaining di default, altrimenti usa dev_effort * 8
UPDATE "Project"
SET dev_remaining_h = COALESCE(dev_remaining_h, dev_effort_h, dev_effort * 8),
    bugfix_remaining_h = COALESCE(bugfix_remaining_h, bugfix_effort_h, bugfix_effort * 8),
    tl_remaining_h = COALESCE(tl_remaining_h, tl_effort_h, tl_effort * 8);

COMMIT;
