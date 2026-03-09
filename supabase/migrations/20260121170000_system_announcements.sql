-- System announcements from the development agency
CREATE TABLE IF NOT EXISTS avisos_sistema (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'info', -- 'info', 'warning', 'success', 'update'
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE avisos_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read announcements"
  ON avisos_sistema FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage announcements"
  ON avisos_sistema FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- First announcement
INSERT INTO avisos_sistema (titulo, mensaje, tipo) VALUES (
  'Sistema actualizado',
  'Estimados usuarios, les informamos que hemos migrado el sistema a un nuevo servidor para brindarles una mejor experiencia. Se realizaron mejoras en el rendimiento, la navegación y nuevas funcionalidades como el chat interno. Disculpen las molestias que esto pueda haber ocasionado. Ante cualquier duda, comuníquense a través del chat.',
  'update'
);
