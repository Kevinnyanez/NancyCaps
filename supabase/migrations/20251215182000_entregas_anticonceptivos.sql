-- Migración: crear tabla entregas_anticonceptivos y triggers para decrementar stock
CREATE TABLE IF NOT EXISTS entregas_anticonceptivos (
  id SERIAL PRIMARY KEY,
  paciente_id INTEGER REFERENCES pacientes(id) ON DELETE CASCADE,
  tipo_anticonceptivo_id INTEGER REFERENCES tipos_anticonceptivos(id) ON DELETE RESTRICT,
  cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  fecha_entrega TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  cap_id INTEGER -- cap que realiza la entrega (para trazabilidad)
);

ALTER TABLE entregas_anticonceptivos ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Admins ven todas las entregas" ON entregas_anticonceptivos;
CREATE POLICY "Admins ven todas las entregas"
  ON entregas_anticonceptivos FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "CAPs ven entregas de su CAP" ON entregas_anticonceptivos;
CREATE POLICY "CAPs ven entregas de su CAP"
  ON entregas_anticonceptivos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles prof
      JOIN pacientes p ON p.id = entregas_anticonceptivos.paciente_id
      WHERE prof.id = auth.uid() AND (
        prof.role = 'admin' OR (prof.role = 'cap_user' AND prof.cap_number = (SELECT numero FROM caps WHERE caps.id = p.cap_id))
      )
    )
  );

DROP POLICY IF EXISTS "Crear entregas según CAP" ON entregas_anticonceptivos;
CREATE POLICY "Crear entregas según CAP"
  ON entregas_anticonceptivos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pacientes pcheck
      JOIN profiles prof ON prof.id = auth.uid()
      WHERE pcheck.id = paciente_id AND (
        prof.role = 'admin' OR (prof.role = 'cap_user' AND prof.cap_number = (SELECT numero FROM caps WHERE caps.id = pcheck.cap_id))
      )
    )
  );

-- Trigger function: decrementar stock en inventario_caps al insertar entrega
CREATE OR REPLACE FUNCTION reduce_stock_on_entrega_insert()
RETURNS TRIGGER AS $$
DECLARE
  inv RECORD;
BEGIN
  -- Determine cap_id: if provided use it, otherwise try to derive from paciente
  IF NEW.cap_id IS NULL THEN
    SELECT cap_id INTO NEW.cap_id FROM pacientes WHERE id = NEW.paciente_id;
  END IF;

  SELECT * INTO inv FROM inventario_caps WHERE cap_id = NEW.cap_id AND tipo_anticonceptivo_id = NEW.tipo_anticonceptivo_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay inventario para este anticonceptivo en este CAP';
  END IF;

  IF inv.stock < NEW.cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %', inv.stock;
  END IF;

  UPDATE inventario_caps SET stock = stock - NEW.cantidad WHERE id = inv.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reduce_stock_on_entrega_insert ON entregas_anticonceptivos;
CREATE TRIGGER trg_reduce_stock_on_entrega_insert
  BEFORE INSERT ON entregas_anticonceptivos
  FOR EACH ROW
  EXECUTE FUNCTION reduce_stock_on_entrega_insert();

-- After insert trigger: registrar movimiento en inventario_movimientos
CREATE OR REPLACE FUNCTION insert_movement_after_entrega()
RETURNS TRIGGER AS $$
DECLARE
  inv RECORD;
BEGIN
  SELECT * INTO inv FROM inventario_caps WHERE cap_id = NEW.cap_id AND tipo_anticonceptivo_id = NEW.tipo_anticonceptivo_id LIMIT 1;

  IF FOUND THEN
    INSERT INTO inventario_movimientos (inventario_id, tipo, cantidad, paciente_id, created_by, created_at)
    VALUES (inv.id, 'out', NEW.cantidad, NEW.paciente_id, NEW.created_by, NEW.created_at);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_insert_movement_after_entrega ON entregas_anticonceptivos;
CREATE TRIGGER trg_insert_movement_after_entrega
  AFTER INSERT ON entregas_anticonceptivos
  FOR EACH ROW
  EXECUTE FUNCTION insert_movement_after_entrega();

-- Índices
CREATE INDEX IF NOT EXISTS idx_entregas_paciente_id ON entregas_anticonceptivos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_entregas_tipo ON entregas_anticonceptivos(tipo_anticonceptivo_id);
