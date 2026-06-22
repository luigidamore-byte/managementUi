-- Migration: Aggiunge colonne effort in ore alla tabella Project e migra i valori esistenti
BEGIN;

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS dev_effort_h numeric,
  ADD COLUMN IF NOT EXISTS bugfix_effort_h numeric,
  ADD COLUMN IF NOT EXISTS tl_effort_h numeric;

-- Popola le nuove colonne moltiplicando i valori esistenti (m/d) per 8 ore
UPDATE "Project"
SET dev_effort_h = COALESCE(dev_effort_h, dev_effort * 8),
    bugfix_effort_h = COALESCE(bugfix_effort_h, bugfix_effort * 8),
    tl_effort_h = COALESCE(tl_effort_h, tl_effort * 8);

COMMIT;
