-- Crear tabla de inventario por CAP y movimientos, añadir cap_id a registros, y actualizar trigger

-- Tabla de inventario por CAP
CREATE TABLE IF NOT EXISTS inventario_caps (
  id SERIAL PRIMARY KEY,
  cap_id INTEGER REFERENCES caps(id) ON DELETE CASCADE,
  tipo_anticonceptivo_id INTEGER REFERENCES tipos_anticonceptivos(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cap_id, tipo_anticonceptivo_id)
);

ALTER TABLE inventario_caps ENABLE ROW LEVEL SECURITY;

-- Policies: CAP users see only su CAP, admins see all
DROP POLICY IF EXISTS "Ver inventario por CAP" ON inventario_caps;
CREATE POLICY "Ver inventario por CAP"
  ON inventario_caps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles prof
      WHERE prof.id = auth.uid() AND (
        prof.role = 'admin' OR (prof.role = 'cap_user' AND prof.cap_number = (SELECT numero FROM caps WHERE caps.id = inventario_caps.cap_id))
      )
    )
  );

DROP POLICY IF EXISTS "Solo admins pueden crear inventario" ON inventario_caps;
CREATE POLICY "Solo admins pueden crear inventario"
  ON inventario_caps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Solo admins pueden actualizar inventario" ON inventario_caps;
CREATE POLICY "Solo admins pueden actualizar inventario"
  ON inventario_caps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Solo admins pueden eliminar inventario" ON inventario_caps;
CREATE POLICY "Solo admins pueden eliminar inventario"
  ON inventario_caps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Tabla de movimientos de inventario para auditoría
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id SERIAL PRIMARY KEY,
  inventario_id INTEGER REFERENCES inventario_caps(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('in','out')),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  paciente_id INTEGER REFERENCES pacientes(id),
  registro_id INTEGER REFERENCES registros_anticonceptivos(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE inventario_movimientos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver movimientos admin y CAP" ON inventario_movimientos;
CREATE POLICY "Ver movimientos admin y CAP"
  ON inventario_movimientos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles prof WHERE prof.id = auth.uid() AND (
        prof.role = 'admin' OR (prof.role = 'cap_user' AND prof.cap_number = (SELECT numero FROM caps WHERE caps.id = (SELECT cap_id FROM inventario_caps WHERE id = inventario_movimientos.inventario_id)))
      )
    )
  );

DROP POLICY IF EXISTS "Solo admins pueden insertar movimientos inventario" ON inventario_movimientos;
CREATE POLICY "Solo admins pueden insertar movimientos inventario"
  ON inventario_movimientos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Añadir cap_id a registros_anticonceptivos para rastrear de qué CAP viene el stock
ALTER TABLE registros_anticonceptivos
  ADD COLUMN IF NOT EXISTS cap_id INTEGER REFERENCES caps(id);

-- Regla: si hay un stock global en tipos_anticonceptivos, migrarlo al primer CAP y dejar el global en 0
DO $$
DECLARE
  t RECORD;
  first_cap INTEGER;
  has_stock_col BOOLEAN := FALSE;
BEGIN
  -- Solo intentar migrar si la columna "stock" existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tipos_anticonceptivos' AND column_name = 'stock'
  ) INTO has_stock_col;

  IF NOT has_stock_col THEN
    RAISE NOTICE 'Columna tipos_anticonceptivos.stock no existe, se omite migración de stock global.';
    RETURN;
  END IF;

  SELECT id INTO first_cap FROM caps ORDER BY id LIMIT 1;
  FOR t IN SELECT id, stock FROM tipos_anticonceptivos WHERE stock IS NOT NULL AND stock > 0 LOOP
    INSERT INTO inventario_caps (cap_id, tipo_anticonceptivo_id, stock)
    VALUES (first_cap, t.id, t.stock)
    ON CONFLICT (cap_id, tipo_anticonceptivo_id) DO NOTHING;

    UPDATE tipos_anticonceptivos SET stock = 0 WHERE id = t.id;
  END LOOP;
END$$;

-- NOTA: una vez verificada la migración, se puede crear una migración adicional para eliminar
-- la columna global `tipos_anticonceptivos.stock` para evitar confusiones futuras.

-- Refrescar/crear función de trigger para disminuir stock por CAP y registrar movimiento
CREATE OR REPLACE FUNCTION reduce_stock_on_registro_insert()
RETURNS TRIGGER AS $$
DECLARE
  current_stock INTEGER;
  inv_id INTEGER;
  patient_cap INTEGER;
BEGIN
  -- Determinar cap del paciente
  SELECT cap_id INTO patient_cap FROM pacientes WHERE id = NEW.paciente_id;
  IF patient_cap IS NULL THEN
    RAISE EXCEPTION 'Paciente no tiene CAP asignado';
  END IF;

  -- Asignar cap_id al registro
  NEW.cap_id := patient_cap;

  -- Obtener inventario para ese cap y tipo
  SELECT id, stock INTO inv_id, current_stock FROM inventario_caps
    WHERE cap_id = patient_cap AND tipo_anticonceptivo_id = NEW.tipo_anticonceptivo_id
    FOR UPDATE;

  IF inv_id IS NULL THEN
    RAISE EXCEPTION 'No hay inventario configurado para este CAP y tipo de anticonceptivo';
  END IF;

  IF current_stock < NEW.cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente para CAP. Disponible: %', current_stock;
  END IF;

  UPDATE inventario_caps SET stock = stock - NEW.cantidad WHERE id = inv_id;

  -- La inserción en inventario_movimientos se realiza ahora en un trigger AFTER INSERT que añade registro_id

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reemplaza trigger anterior
DROP TRIGGER IF EXISTS trg_reduce_stock_on_registro_insert ON registros_anticonceptivos;
CREATE TRIGGER trg_reduce_stock_on_registro_insert
  BEFORE INSERT ON registros_anticonceptivos
  FOR EACH ROW
  EXECUTE FUNCTION reduce_stock_on_registro_insert();
