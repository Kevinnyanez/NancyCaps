-- ============================================
-- SCRIPT PARA VERIFICAR Y CORREGIR POLÍTICAS
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- PASO 1: Verificar que la función get_user_role existe y funciona
SELECT 
  proname as function_name,
  proargtypes::regtype[] as argument_types,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'get_user_role';

-- PASO 2: Verificar el rol del usuario actual
SELECT 
  id,
  email,
  role,
  cap_number
FROM public.profiles
WHERE email = 'admin@caps.com';

-- PASO 3: Probar la función get_user_role con el usuario admin
-- (Reemplaza el UUID con el del usuario admin)
SELECT 
  public.get_user_role(id) as user_role,
  email,
  role
FROM public.profiles
WHERE email = 'admin@caps.com';

-- PASO 4: Eliminar y recrear políticas de tipos_anticonceptivos
DROP POLICY IF EXISTS "Authenticated users can view tipos_anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Admins can insert tipos_anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Admins can update tipos_anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Admins can delete tipos_anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Solo admins pueden crear tipos de anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Solo admins pueden actualizar tipos de anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Solo admins pueden eliminar tipos de anticonceptivos" ON public.tipos_anticonceptivos;
DROP POLICY IF EXISTS "Todos los usuarios autenticados pueden ver tipos de anticonceptivos" ON public.tipos_anticonceptivos;

-- PASO 5: Crear políticas corregidas
-- SELECT: Todos los usuarios autenticados pueden ver
CREATE POLICY "Authenticated users can view tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- INSERT: Solo admins pueden crear
CREATE POLICY "Admins can insert tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR INSERT
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- UPDATE: Solo admins pueden actualizar
CREATE POLICY "Admins can update tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR UPDATE
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- DELETE: Solo admins pueden eliminar
CREATE POLICY "Admins can delete tipos_anticonceptivos"
ON public.tipos_anticonceptivos
FOR DELETE
USING (public.get_user_role(auth.uid()) = 'admin');

-- PASO 6: Verificar que las políticas se crearon correctamente
SELECT 
  policyname,
  cmd as operation,
  permissive,
  roles,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE tablename = 'tipos_anticonceptivos'
ORDER BY cmd, policyname;

