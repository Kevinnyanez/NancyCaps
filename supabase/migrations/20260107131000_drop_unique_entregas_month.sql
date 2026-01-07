-- 2026-01-07: Revertir índice único de entregas por mes — permitir entregas duplicadas y usar advertencias en UI
BEGIN;

-- Eliminar índice único si existe
DROP INDEX IF EXISTS unique_entregas_paciente_tipo_month;

COMMIT;

-- Nota: ejecutar esta migración en la base de datos para permitir múltiples entregas en el mismo mes,
-- mientras que la app mostrará advertencias pero no impedirá registrar la entrega.
