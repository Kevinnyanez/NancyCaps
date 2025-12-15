-- ============================================
-- SCRIPT SIMPLE PARA CORREGIR POLÍTICAS
-- Usa verificación directa sin función helper
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Eliminar todas las políticas existentes de tipos_anticonceptivos
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'tipos_anticonceptivos' AND schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.tipos_anticonceptivos', r.policyname);
    END LOOP;
END $$;

-- Crear políticas simples y directas
-- SELECT: Todos los usuarios autenticados pueden ver
CREATE POLICY "tipos_anticonceptivos_select"
ON public.tipos_anticonceptivos
FOR SELECT
TO authenticated
USING (true);

-- INSERT: Solo admins pueden crear
CREATE POLICY "tipos_anticonceptivos_insert"
ON public.tipos_anticonceptivos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- UPDATE: Solo admins pueden actualizar
CREATE POLICY "tipos_anticonceptivos_update"
ON public.tipos_anticonceptivos
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

-- DELETE: Solo admins pueden eliminar
CREATE POLICY "tipos_anticonceptivos_delete"
ON public.tipos_anticonceptivos
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
WHERE tablename = 'tipos_anticonceptivos'
ORDER BY cmd;

