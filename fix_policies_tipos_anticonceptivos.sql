-- ============================================
-- SCRIPT PARA CORREGIR POLÍTICAS DE tipos_anticonceptivos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Eliminar políticas existentes de tipos_anticonceptivos
DROP POLICY IF EXISTS "Authenticated users can view tipos_anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Admins can insert tipos_anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Admins can update tipos_anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Admins can delete tipos_anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Solo admins pueden crear tipos de anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Solo admins pueden actualizar tipos de anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Solo admins pueden eliminar tipos de anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Todos los usuarios autenticados pueden ver tipos de anticonceptivos" ON public.tipos_anticonceptivos;

-- Crear políticas corregidas usando la función get_user_role
-- Política para SELECT: todos los usuarios autenticados pueden ver
CREATE POLICY "Authenticated users can view tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Política para INSERT: solo admins pueden crear
CREATE POLICY "Admins can insert tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Política para UPDATE: solo admins pueden actualizar
CREATE POLICY "Admins can update tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- Política para DELETE: solo admins pueden eliminar
CREATE POLICY "Admins can delete tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'admin');

-- Verificar que las políticas se crearon correctamente
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'tipos_anticonceptivos'
ORDER BY policyname;

