-- Añadir columna de código identificador a tipos_anticonceptivos
-- El código es único pero opcional para no romper datos existentes

ALTER TABLE tipos_anticonceptivos
  ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE;

