-- Allow admins to INSERT into entrega_notificaciones

-- This policy allows authenticated users with role = 'admin' in profiles to insert notifications

DROP POLICY IF EXISTS "Admins pueden insertar notificaciones" ON entrega_notificaciones;
CREATE POLICY "Admins pueden insertar notificaciones"
  ON entrega_notificaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Optionally you could add a policy to allow server-side functions or triggers to insert as well (not needed if triggers use SECURITY DEFINER functions)


-- Note: Run migrations (supabase db push / supabase migrate) in staging before applying to production.