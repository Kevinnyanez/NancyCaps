-- 2026-01-07: Evitar duplicados de entregas por paciente/tipo dentro del mismo mes
BEGIN;

-- Crear índice único por paciente,tipo y mes (date_trunc month sobre fecha_entrega)
CREATE UNIQUE INDEX IF NOT EXISTS unique_entregas_paciente_tipo_month ON entregas_anticonceptivos (
  paciente_id,
  tipo_anticonceptivo_id,
  date_trunc('month', fecha_entrega)
);

COMMIT;
