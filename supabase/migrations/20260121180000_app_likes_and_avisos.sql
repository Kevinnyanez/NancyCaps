-- App likes system: one like per user
CREATE TABLE IF NOT EXISTS app_likes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE app_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read likes"
  ON app_likes FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own like"
  ON app_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own like"
  ON app_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Remove the old generic announcement and replace with separated ones
DELETE FROM avisos_sistema WHERE titulo = 'Sistema actualizado';

-- 1) Server migration
INSERT INTO avisos_sistema (titulo, mensaje, tipo, created_at) VALUES (
  'Migración de servidor',
  'Estimados usuarios, les informamos que hemos migrado el sistema a un nuevo servidor para brindarles una mayor estabilidad y velocidad en su operación diaria. Disculpen las molestias que esto pueda haber ocasionado durante el proceso.',
  'warning',
  now() - interval '2 minutes'
);

-- 2) System update / new features
INSERT INTO avisos_sistema (titulo, mensaje, tipo, created_at) VALUES (
  'Nuevas funcionalidades disponibles',
  'Hemos actualizado el sistema con mejoras importantes:

• Chat interno: ahora pueden comunicarse entre CAPs y con la administración directamente desde el sistema, sin necesidad de usar otra herramienta.
• Diseño renovado: ajustamos la interfaz (UX/UI) para que la navegación sea más clara e intuitiva.
• Alertas mejoradas: el sistema detecta pacientes registrados en múltiples CAPs con mayor precisión.
• Pedidos optimizados: pueden ajustar mínimos y cantidades directamente desde la tabla.
• Entregas simplificadas: búsqueda directa de pacientes y anticonceptivos sin pasos intermedios.

Esperamos que estas mejoras faciliten su trabajo diario.',
  'update',
  now() - interval '1 minute'
);

-- 3) Communication channel
INSERT INTO avisos_sistema (titulo, mensaje, tipo) VALUES (
  'Estamos trabajando para mejorar',
  'Nuestro equipo de desarrollo sigue trabajando para ofrecerles la mejor experiencia posible. Todo posible inconveniente o novedad será comunicada por este canal de notificaciones.

Ante cualquier duda o sugerencia, no duden en comunicarse a través del chat interno. ¡Gracias por confiar en nosotros!',
  'info'
);
