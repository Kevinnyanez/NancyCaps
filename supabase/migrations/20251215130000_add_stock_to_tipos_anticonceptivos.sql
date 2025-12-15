-- Añadir columna stock a tipos_anticonceptivos y trigger para descontar stock

ALTER TABLE tipos_anticonceptivos
  ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0);

-- Garantizar que todos pueden ver el stock (ya existe política SELECT para authenticated)

-- Función para descontar stock al crear un registro
CREATE OR REPLACE FUNCTION reduce_stock_on_registro_insert()
RETURNS TRIGGER AS $$
DECLARE
  current_stock INTEGER;
BEGIN
  -- Bloqueamos la fila para evitar race conditions
  SELECT stock INTO current_stock FROM tipos_anticonceptivos WHERE id = NEW.tipo_anticonceptivo_id FOR UPDATE;

  IF current_stock IS NULL THEN
    RAISE EXCEPTION 'Tipo de anticonceptivo no encontrado';
  END IF;

  IF current_stock < NEW.cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente. Disponible: %', current_stock;
  END IF;

  UPDATE tipos_anticonceptivos
  SET stock = stock - NEW.cantidad
  WHERE id = NEW.tipo_anticonceptivo_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que ejecuta la función antes de insertar registros
DROP TRIGGER IF EXISTS trg_reduce_stock_on_registro_insert ON registros_anticonceptivos;
CREATE TRIGGER trg_reduce_stock_on_registro_insert
  BEFORE INSERT ON registros_anticonceptivos
  FOR EACH ROW
  EXECUTE FUNCTION reduce_stock_on_registro_insert();
