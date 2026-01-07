-- 2026-01-07: Cambiar constraint UNIQUE sobre dni por una única por (lower(dni), cap_id)
BEGIN;

-- Remover la constraint UNIQUE global sobre dni si existe
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pacientes_dni_key'
  ) THEN
    ALTER TABLE pacientes DROP CONSTRAINT pacientes_dni_key;
  END IF;
END
$$;

-- Crear índice único por CAP, case-insensitive en dni
CREATE UNIQUE INDEX IF NOT EXISTS unique_pacientes_dni_cap ON pacientes (lower(dni), cap_id);

COMMIT;

-- Nota: ejecutar esta migración en la base de datos (Supabase SQL editor o CLI) para aplicar el cambio.
