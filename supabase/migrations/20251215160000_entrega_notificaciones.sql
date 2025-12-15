-- Crear tabla de notificaciones de entrega para avisar a CAPs si un paciente con mismo DNI recibió el mismo tipo en otra CAP

CREATE TABLE IF NOT EXISTS entrega_notificaciones (
  id SERIAL PRIMARY KEY,
  registro_id INTEGER REFERENCES registros_anticonceptivos(id),
  paciente_id INTEGER REFERENCES pacientes(id),
  dni TEXT NOT NULL,
  tipo_anticonceptivo_id INTEGER REFERENCES tipos_anticonceptivos(id),
  cap_origen INTEGER REFERENCES caps(id),
  cap_destino INTEGER REFERENCES caps(id),
  mensaje TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE entrega_notificaciones ENABLE ROW LEVEL SECURITY;

-- Políticas: los admins ven todas, las CAPs ven las notificaciones dirigidas a su CAP
DROP POLICY IF EXISTS "Admins ven todas las notificaciones" ON entrega_notificaciones;
CREATE POLICY "Admins ven todas las notificaciones"
  ON entrega_notificaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "CAPs ven notificaciones dirigidas a su CAP" ON entrega_notificaciones;
CREATE POLICY "CAPs ven notificaciones dirigidas a su CAP"
  ON entrega_notificaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'cap_user' AND p.cap_number = (SELECT numero FROM caps WHERE caps.id = entrega_notificaciones.cap_destino)
    )
  );

-- Permitir eliminación solo a admins (opcional)
DROP POLICY IF EXISTS "Solo admins pueden eliminar notificaciones" ON entrega_notificaciones;
CREATE POLICY "Solo admins pueden eliminar notificaciones"
  ON entrega_notificaciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Función AFTER INSERT para crear notificaciones cuando un registro se inserta
CREATE OR REPLACE FUNCTION notify_delivery_on_registro_insert()
RETURNS TRIGGER AS $$
DECLARE
  orig_dni TEXT;
  other_p RECORD;
  msg TEXT;
BEGIN
  SELECT dni INTO orig_dni FROM pacientes WHERE id = NEW.paciente_id;
  IF orig_dni IS NULL THEN
    RETURN NULL;
  END IF;

  FOR other_p IN
    SELECT id, cap_id FROM pacientes WHERE dni = orig_dni AND cap_id IS NOT NULL AND cap_id <> NEW.cap_id
  LOOP
    msg := format('Paciente con DNI %s recibió %s en %s', orig_dni, (SELECT nombre FROM tipos_anticonceptivos WHERE id = NEW.tipo_anticonceptivo_id), (SELECT nombre FROM caps WHERE id = NEW.cap_id));

    INSERT INTO entrega_notificaciones (registro_id, paciente_id, dni, tipo_anticonceptivo_id, cap_origen, cap_destino, mensaje, created_by)
    VALUES (NEW.id, other_p.id, orig_dni, NEW.tipo_anticonceptivo_id, NEW.cap_id, other_p.cap_id, msg, NEW.created_by)
    ON CONFLICT (registro_id, tipo_anticonceptivo_id, cap_origen, cap_destino) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_entrega_notificaciones_cap_destino ON entrega_notificaciones(cap_destino);
CREATE INDEX IF NOT EXISTS idx_entrega_notificaciones_tipo ON entrega_notificaciones(tipo_anticonceptivo_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entrega_notificaciones_unique_registro_tipo_caps ON entrega_notificaciones(registro_id, tipo_anticonceptivo_id, cap_origen, cap_destino);

-- Trigger que ejecuta la notificación después de insertar un registro
DROP TRIGGER IF EXISTS trg_notify_delivery_on_registro_insert ON registros_anticonceptivos;
CREATE TRIGGER trg_notify_delivery_on_registro_insert
  AFTER INSERT ON registros_anticonceptivos
  FOR EACH ROW
  EXECUTE FUNCTION notify_delivery_on_registro_insert();
