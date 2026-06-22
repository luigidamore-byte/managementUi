-- Migration: Crea la tabella TimeLogs per tracciare ore registrate
BEGIN;

CREATE TABLE IF NOT EXISTS "TimeLogs" (
  id serial PRIMARY KEY,
  person_id integer REFERENCES "Persone"(id) ON DELETE SET NULL,
  project_id integer REFERENCES "Project"(id) ON DELETE CASCADE,
  type text NOT NULL,
  hours numeric NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

COMMIT;
