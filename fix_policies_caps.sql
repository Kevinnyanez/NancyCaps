-- ============================================
-- SCRIPT PARA CORREGIR POLÍTICAS DE CAPS
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Eliminar todas las políticas existentes de caps
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'caps' AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.caps', r.policyname);
    END LOOP;
END $$;

-- Crear políticas simples y directas para caps
-- SELECT: Todos los usuarios autenticados pueden ver CAPs
CREATE POLICY "caps_select"
ON public.caps
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Solo admins pueden crear CAPs
CREATE POLICY "caps_insert"
ON public.caps
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- UPDATE: Solo admins pueden actualizar CAPs
CREATE POLICY "caps_update"
ON public.caps
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- DELETE: Solo admins pueden eliminar CAPs
CREATE POLICY "caps_delete"
ON public.caps
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Verificar que se crearon correctamente
SELECT 
  policyname,
  cmd as operation,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'caps'
ORDER BY cmd;

