-- ============================================
-- SCRIPT PARA VERIFICAR EL ADMINISTRADOR
-- ============================================

-- Verificar todos los usuarios y sus roles
SELECT 
  id,
  email,
  role,
  cap_number,
  created_at
FROM public.profiles
ORDER BY created_at DESC;

-- Verificar específicamente el administrador
SELECT 
  id,
  email,
  role,
  cap_number,
  created_at
FROM public.profiles
WHERE email = 'admin@caps.com';

-- Si el usuario existe pero no tiene rol admin, asignarlo:
-- UPDATE public.profiles 
-- SET role = 'admin' 
-- WHERE email = 'admin@caps.com';

