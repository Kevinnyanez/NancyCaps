-- Ajustes: eliminar inserción de movimiento desde BEFORE trigger, añadir AFTER trigger para insertar movimiento con registro_id

-- Reemplazar función reduce_stock_on_registro_insert para remover inserción de movimiento
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

  -- NOTA: la inserción en inventario_movimientos se realiza en un trigger AFTER INSERT
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear función AFTER INSERT para insertar movimiento con registro_id
CREATE OR REPLACE FUNCTION insert_movement_after_registro()
RETURNS TRIGGER AS $$
DECLARE
  inv_id INTEGER;
BEGIN
  -- Obtener inventario para ese cap y tipo
  SELECT id INTO inv_id FROM inventario_caps
    WHERE cap_id = NEW.cap_id AND tipo_anticonceptivo_id = NEW.tipo_anticonceptivo_id
    LIMIT 1;

  IF inv_id IS NULL THEN
    -- No hay inventario configurado; nada que registrar
    RETURN NEW;
  END IF;

  INSERT INTO inventario_movimientos (inventario_id, tipo, cantidad, paciente_id, registro_id, created_by)
  VALUES (inv_id, 'out', NEW.cantidad, NEW.paciente_id, NEW.id, NEW.created_by);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger AFTER INSERT que añade movimiento con referencia al registro
DROP TRIGGER IF EXISTS trg_insert_movement_after_registro ON registros_anticonceptivos;
CREATE TRIGGER trg_insert_movement_after_registro
  AFTER INSERT ON registros_anticonceptivos
  FOR EACH ROW
  EXECUTE FUNCTION insert_movement_after_registro();
